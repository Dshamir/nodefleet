/**
 * ReBAC (Relationship-Based Access Control) Permission Engine
 *
 * Defines a declarative permission matrix mapping resources + actions to minimum role levels.
 * Role hierarchy: platform_admin(5) > owner(4) > admin(3) > member(2) > viewer(1)
 */

export type Role = 'viewer' | 'member' | 'admin' | 'owner' | 'platform_admin'

export type Resource =
  | 'device'
  | 'fleet'
  | 'schedule'
  | 'content'
  | 'audit'
  | 'settings'
  | 'billing'
  | 'commerce'
  | 'analytics'
  | 'crm'
  | 'marketing'
  | 'operations'
  | 'development'
  | 'admin'
  | 'notification'

export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage'

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
  platform_admin: 5,
}

/**
 * Permission matrix — each entry defines the minimum role required for a resource+action pair.
 * If a combination is not listed, it defaults to 'owner'.
 */
const PERMISSIONS: Record<string, Role> = {
  // Devices
  'device:read': 'viewer',
  'device:create': 'member',
  'device:update': 'member',
  'device:delete': 'admin',
  'device:manage': 'admin',

  // Fleets
  'fleet:read': 'viewer',
  'fleet:create': 'admin',
  'fleet:update': 'admin',
  'fleet:delete': 'admin',
  'fleet:manage': 'admin',

  // Schedules
  'schedule:read': 'viewer',
  'schedule:create': 'member',
  'schedule:update': 'member',
  'schedule:delete': 'admin',
  'schedule:manage': 'admin',

  // Content / Media
  'content:read': 'viewer',
  'content:create': 'member',
  'content:update': 'member',
  'content:delete': 'admin',
  'content:manage': 'admin',

  // Audit
  'audit:read': 'viewer',
  'audit:create': 'admin',
  'audit:manage': 'owner',

  // Settings
  'settings:read': 'viewer',
  'settings:update': 'admin',
  'settings:manage': 'owner',

  // Billing
  'billing:read': 'admin',
  'billing:update': 'owner',
  'billing:manage': 'owner',

  // Commerce
  'commerce:read': 'viewer',
  'commerce:create': 'member',
  'commerce:update': 'admin',
  'commerce:delete': 'admin',
  'commerce:manage': 'owner',

  // Analytics
  'analytics:read': 'viewer',
  'analytics:manage': 'admin',

  // CRM
  'crm:read': 'member',
  'crm:create': 'member',
  'crm:update': 'member',
  'crm:delete': 'admin',
  'crm:manage': 'admin',

  // Marketing
  'marketing:read': 'member',
  'marketing:create': 'admin',
  'marketing:update': 'admin',
  'marketing:delete': 'admin',
  'marketing:manage': 'owner',

  // Operations
  'operations:read': 'admin',
  'operations:update': 'admin',
  'operations:manage': 'owner',

  // Development
  'development:read': 'member',
  'development:create': 'member',
  'development:update': 'member',
  'development:delete': 'admin',
  'development:manage': 'admin',

  // Platform Admin (global)
  'admin:read': 'platform_admin',
  'admin:create': 'platform_admin',
  'admin:update': 'platform_admin',
  'admin:delete': 'platform_admin',
  'admin:manage': 'platform_admin',

  // Notifications
  'notification:read': 'viewer',
  'notification:update': 'viewer',
  'notification:manage': 'admin',
}

/**
 * Check if a role has permission for a given resource+action.
 */
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  const key = `${resource}:${action}`
  const minRole = PERMISSIONS[key] || 'owner'
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]
}

/**
 * Get the minimum required role for a resource+action.
 */
export function getMinRole(resource: Resource, action: Action): Role {
  const key = `${resource}:${action}`
  return (PERMISSIONS[key] as Role) || 'owner'
}

/**
 * Get all permissions for a given role (for UI rendering).
 */
export function getPermissionsForRole(role: Role): Array<{ resource: Resource; action: Action }> {
  const result: Array<{ resource: Resource; action: Action }> = []
  for (const [key, minRole] of Object.entries(PERMISSIONS)) {
    if (ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]) {
      const [resource, action] = key.split(':') as [Resource, Action]
      result.push({ resource, action })
    }
  }
  return result
}
