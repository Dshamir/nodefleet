import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from './db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authConfig } from './auth.config'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const fullAuthConfig = {
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = credentialsSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          return null
        }

        const { email, password } = parsedCredentials.data

        try {
          const user = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.email, email),
            with: {
              orgMembers: {
                with: {
                  organization: true,
                },
              },
            },
          })

          if (!user) {
            return null
          }

          const passwordMatch = await bcrypt.compare(password, user.passwordHash || '')

          if (!passwordMatch) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  adapter: DrizzleAdapter(db),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.image = user.image
      }

      if (trigger === 'update' && session) {
        return { ...token, ...session }
      }

      // Fetch user details including organization and role
      if (token.id) {
        try {
          const dbUser = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.id, token.id as string),
            with: {
              orgMembers: {
                with: {
                  organization: true,
                },
              },
            },
          })

          if (dbUser) {
            // Always sync name/email from DB so profile updates take effect
            token.name = dbUser.name
            token.email = dbUser.email
            token.image = dbUser.image
            token.userRole = dbUser.role // global user role (user/admin)

            if (dbUser.orgMembers && dbUser.orgMembers.length > 0) {
              const primaryMembership = dbUser.orgMembers[0]
              token.orgId = primaryMembership.orgId
              token.role = primaryMembership.role // org membership role
            }
          }
        } catch (error) {
          console.error('JWT callback error:', error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.image as string
        session.user.orgId = token.orgId as string | undefined
        session.user.role = token.role as string | undefined
        session.user.userRole = token.userRole as string | undefined
      }

      return session
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  pages: {
    signIn: '/login',
    signUp: '/register',
    error: '/login',
  },
  events: {
    async signOut() {
      // Handle sign out events if needed
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(fullAuthConfig)

// Extend the session type
declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
  }

  interface Session {
    user: User & {
      orgId?: string
      role?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    name?: string | null
    image?: string | null
    orgId?: string
    role?: string
  }
}
