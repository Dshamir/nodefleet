import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const publicRoutes = ['/login', '/register', '/forgot-password', '/api/auth']
const protectedRoutes = ['/devices', '/settings', '/content', '/map', '/schedules', '/api/protected']

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isAuthenticated = !!req.auth?.user

  const pathname = req.nextUrl.pathname

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
      return NextResponse.redirect(new URL('/devices', req.nextUrl.origin))
    }
    return NextResponse.next()
  }

  // Protect dashboard and other protected routes
  if (isProtectedRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', req.nextUrl.origin)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Allow all other routes
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
