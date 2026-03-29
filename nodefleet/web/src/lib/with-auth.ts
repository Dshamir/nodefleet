import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { db } from './db'
import { orgMembers } from './db/schema'
import { eq } from 'drizzle-orm'
import { hasPermission, type Resource, type Action, type Role } from './rbac'
import { createLogger } from './logger'
import { ErrorCode } from './errors'

const logger = createLogger('with-auth')

export interface AuthContext {
  userId: string
  orgId: string
  role: Role
  via: 'session' | 'apikey'
}

interface WithAuthOptions {
  resource: Resource
  action: Action
}

type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext & { params?: Record<string, string> }
) => Promise<NextResponse>

/**
 * Higher-order function that wraps API route handlers with authentication and ReBAC authorization.
 *
 * Usage:
 *   export const GET = withAuth(async (request, { userId, orgId, role }) => {
 *     // handler logic
 *   }, { resource: 'device', action: 'read' })
 */
export function withAuth(handler: AuthenticatedHandler, options: WithAuthOptions) {
  return async (request: NextRequest, routeContext?: { params?: Record<string, string> }) => {
    try {
      // Authenticate
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: { code: ErrorCode.AUTH_SESSION_EXPIRED, message: 'Authentication required' } },
          { status: 401 }
        )
      }

      const userId = session.user.id

      // Get org membership and role
      const [membership] = await db
        .select({
          orgId: orgMembers.orgId,
          role: orgMembers.role,
        })
        .from(orgMembers)
        .where(eq(orgMembers.userId, userId))
        .limit(1)

      if (!membership) {
        return NextResponse.json(
          { error: { code: ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS, message: 'No organization membership found' } },
          { status: 403 }
        )
      }

      const role = (session.user.role === 'admin' ? 'platform_admin' : membership.role) as Role

      // Authorize via ReBAC
      if (!hasPermission(role, options.resource, options.action)) {
        logger.warn('Permission denied', {
          userId,
          orgId: membership.orgId,
          role,
          resource: options.resource,
          action: options.action,
        })
        return NextResponse.json(
          { error: { code: ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS, message: `Insufficient permissions: ${options.resource}:${options.action} requires higher role` } },
          { status: 403 }
        )
      }

      // Call handler with auth context
      return handler(request, {
        userId,
        orgId: membership.orgId,
        role,
        via: 'session',
        params: routeContext?.params,
      })
    } catch (error) {
      logger.error('Auth wrapper error', { error: String(error) })
      return NextResponse.json(
        { error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' } },
        { status: 500 }
      )
    }
  }
}

/**
 * Simplified auth check — just requires authentication, no specific permission.
 * Use for routes where any authenticated user should have access (e.g., notifications).
 */
export function withAuthOnly(handler: AuthenticatedHandler) {
  return async (request: NextRequest, routeContext?: { params?: Record<string, string> }) => {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: { code: ErrorCode.AUTH_SESSION_EXPIRED, message: 'Authentication required' } },
          { status: 401 }
        )
      }

      const [membership] = await db
        .select({
          orgId: orgMembers.orgId,
          role: orgMembers.role,
        })
        .from(orgMembers)
        .where(eq(orgMembers.userId, session.user.id))
        .limit(1)

      if (!membership) {
        return NextResponse.json(
          { error: { code: ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS, message: 'No organization membership found' } },
          { status: 403 }
        )
      }

      const role = (session.user.role === 'admin' ? 'platform_admin' : membership.role) as Role

      return handler(request, {
        userId: session.user.id,
        orgId: membership.orgId,
        role,
        via: 'session',
        params: routeContext?.params,
      })
    } catch (error) {
      logger.error('Auth wrapper error', { error: String(error) })
      return NextResponse.json(
        { error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' } },
        { status: 500 }
      )
    }
  }
}
