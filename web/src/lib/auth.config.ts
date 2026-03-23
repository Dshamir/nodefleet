import type { NextAuthConfig } from 'next-auth'

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
    signUp: '/register',
    error: '/login',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
} satisfies NextAuthConfig
