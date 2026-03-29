import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const publicRoutes = ['/login', '/register', '/forgot-password', '/api/auth']
const protectedRoutes = ['/devices', '/settings', '/content', '/map', '/schedules', '/api/protected', '/commerce', '/crm', '/marketing', '/analytics', '/seo', '/domains', '/operations', '/dev', '/platform-admin', '/security', '/ai', '/knowledge-base']

const allowedOrigin = process.env.CORS_ORIGIN || '*'

function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isAuthenticated = !!req.auth?.user

  const pathname = req.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api/')

  // Handle CORS preflight requests for API routes
  if (isApiRoute && req.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 })
    return setCorsHeaders(preflightResponse)
  }

  // Check if route is public
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === '/api/auth') {
      return pathname.startsWith('/api/auth')
    }
    return pathname === route || pathname.startsWith(`${route}/`)
  })

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) => {
    if (route.startsWith('/api/')) {
      return pathname.startsWith(route)
    }
    return pathname === route || pathname.startsWith(`${route}/`)
  })

  // Allow public routes regardless of authentication
  if (isPublicRoute) {
    // If already authenticated and trying to access login/register, redirect to home
    if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
      const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') || '/'
      return NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin))
    }
    const response = NextResponse.next()
    return isApiRoute ? setCorsHeaders(response) : response
  }

  // Protect dashboard and other protected routes
  if (isProtectedRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', req.nextUrl.origin)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const response = NextResponse.next()
    return isApiRoute ? setCorsHeaders(response) : response
  }

  // Allow all other routes
  const response = NextResponse.next()
  return isApiRoute ? setCorsHeaders(response) : response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
