import type { NextAuthConfig } from 'next-auth'

// Determine if we should use secure (HTTPS-only) cookies.
// In development or when accessed via HTTP, use plain cookies.
const useSecureCookies = process.env.NODE_ENV === 'production'
  && process.env.NEXTAUTH_URL?.startsWith('https://')

// This config is used by the Edge Runtime middleware
// It must NOT import any Node.js-only modules (pg, ioredis, etc.)
export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [], // Providers are added in auth.ts (Node.js runtime only)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    newUser: '/register',
    error: '/login',
  },
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: useSecureCookies ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: useSecureCookies ? '__Secure-authjs.callback-url' : 'authjs.callback-url',
      options: {
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: useSecureCookies ? '__Host-authjs.csrf-token' : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
} satisfies NextAuthConfig
