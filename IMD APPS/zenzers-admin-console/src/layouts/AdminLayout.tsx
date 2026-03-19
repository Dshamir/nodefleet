import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAdminAuth } from '@/auth/useAdminAuth'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

interface NavItem {
  label: string
  icon: string
  path: string
  phase?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    title: '',
    items: [{ label: 'Dashboard', icon: 'pi-th-large', path: '' }],
  },
  {
    title: 'PLATFORM',
    items: [
      { label: 'Tenants', icon: 'pi-building', path: 'tenants' },
      { label: 'Analytics', icon: 'pi-chart-bar', path: 'analytics' },
      { label: 'Settings', icon: 'pi-cog', path: 'settings' },
      { label: 'Tenants Audit Log', icon: 'pi-list', path: 'tenant-audit-log' },
      { label: 'Tenants Login Audit', icon: 'pi-sign-in', path: 'tenant-login-audit' },
    ],
  },
  {
    title: 'MEDICAL',
    items: [
      { label: 'Patients', icon: 'pi-users', path: 'patients' },
      { label: 'Doctors', icon: 'pi-user', path: 'doctors' },
      { label: 'Caregivers', icon: 'pi-heart', path: 'caregivers' },
      { label: 'Vitals Monitor', icon: 'pi-chart-line', path: 'vitals-monitor' },
    ],
  },
  {
    title: 'MEDICAL TOOLS',
    items: [
      { label: 'Medical Records', icon: 'pi-file', path: 'medical-records' },
      { label: 'Emergency Contacts', icon: 'pi-phone', path: 'emergency-contacts' },
      { label: 'Data Access', icon: 'pi-eye', path: 'data-access' },
      { label: 'Gateway Devices', icon: 'pi-wifi', path: 'gateway-devices' },
    ],
  },
  {
    title: 'USERS & AUTH',
    items: [
      { label: 'Access Control', icon: 'pi-lock', path: 'access-control' },
      { label: 'Authentication', icon: 'pi-shield', path: 'authentication' },
      { label: 'Audit Log', icon: 'pi-list', path: 'audit-log' },
    ],
  },
  {
    title: 'SECURITY',
    items: [
      { label: 'Fraud Detection', icon: 'pi-exclamation-triangle', path: 'fraud-detection' },
      { label: 'Content Policy', icon: 'pi-file-edit', path: 'content-policy' },
      { label: 'Rate Limits', icon: 'pi-gauge', path: 'rate-limits' },
      { label: 'Credentials', icon: 'pi-key', path: 'credentials' },
    ],
  },
  {
    title: 'CONTENT',
    items: [
      { label: 'CMS / Content', icon: 'pi-file', path: 'cms' },
      { label: 'OTP Settings', icon: 'pi-mobile', path: 'otp-settings' },
      { label: 'Messaging', icon: 'pi-envelope', path: 'messaging' },
      { label: 'Chat', icon: 'pi-comments', path: 'chat' },
    ],
  },
  {
    title: 'AI PROVIDERS & PROMPTS',
    items: [
      { label: 'AI Settings', icon: 'pi-sliders-h', path: 'ai-settings' },
      { label: 'Custom Agents', icon: 'pi-bolt', path: 'custom-agents' },
      { label: 'Prompt Templates', icon: 'pi-file-edit', path: 'prompt-templates' },
    ],
  },
  {
    title: 'KB \u2014 KNOWLEDGE',
    items: [
      { label: 'Knowledge Base', icon: 'pi-book', path: 'knowledge-base' },
    ],
  },
  {
    title: 'COMMERCE',
    items: [
      { label: 'Orders', icon: 'pi-shopping-bag', path: 'orders' },
      { label: 'Pricing', icon: 'pi-dollar', path: 'pricing' },
      { label: 'Payment Gateways', icon: 'pi-credit-card', path: 'payment-gateways' },
      { label: 'Shop', icon: 'pi-shopping-cart', path: 'shop' },
      { label: 'Shipping', icon: 'pi-truck', path: 'shipping' },
      { label: 'Manufacturing', icon: 'pi-cog', path: 'manufacturing' },
      { label: 'Promo Codes', icon: 'pi-tag', path: 'promo-codes' },
      { label: 'Inventory', icon: 'pi-box', path: 'inventory' },
      { label: 'Invoices', icon: 'pi-file', path: 'invoices' },
      { label: 'Tax Exemptions', icon: 'pi-file-edit', path: 'tax-exemptions' },
      { label: 'Cart Recovery', icon: 'pi-shopping-cart', path: 'cart-recovery' },
      { label: 'Customers', icon: 'pi-users', path: 'customers' },
      { label: 'CRM', icon: 'pi-users', path: 'crm' },
    ],
  },
  {
    title: 'RANKING',
    items: [
      { label: 'Analytics', icon: 'pi-chart-bar', path: 'analytics' },
      { label: 'SEO Settings', icon: 'pi-search', path: 'seo' },
      { label: 'Domain Registry', icon: 'pi-globe', path: 'domains' },
      { label: 'Leads', icon: 'pi-bullseye', path: 'leads' },
      { label: 'Lead Forms', icon: 'pi-file', path: 'lead-forms' },
      { label: 'Campaigns', icon: 'pi-megaphone', path: 'campaigns' },
      { label: 'Lead Scoring', icon: 'pi-star', path: 'lead-scoring' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Database', icon: 'pi-database', path: 'database' },
      { label: 'Feature Flags', icon: 'pi-flag', path: 'feature-flags' },
      { label: 'Network', icon: 'pi-globe', path: 'network' },
      { label: 'Notifications', icon: 'pi-bell', path: 'notifications' },
    ],
  },
  {
    title: 'DEVELOPMENT',
    items: [
      { label: 'Dev Tickets', icon: 'pi-inbox', path: 'support' },
      { label: 'Repair Plans', icon: 'pi-wrench', path: 'repair-plans' },
      { label: 'Version Control', icon: 'pi-github', path: 'version-control' },
      { label: 'Dev Wiki', icon: 'pi-book', path: 'dev-wiki' },
    ],
  },
]

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user, logout } = useAdminAuth()
  const location = useLocation()

  const currentPath = location.pathname.replace(/^\/admin\/?/, '').replace(/\/$/, '')

  // Breadcrumb generation
  const getBreadcrumbs = () => {
    if (!currentPath) return [{ label: 'Dashboard' }]
    for (const section of navigation) {
      for (const item of section.items) {
        if (item.path === currentPath) {
          const crumbs: { label: string; path?: string }[] = [{ label: 'Dashboard', path: '' }]
          if (section.title) crumbs.push({ label: section.title })
          crumbs.push({ label: item.label })
          return crumbs
        }
      }
    }
    // Handle parameterized routes
    if (currentPath.startsWith('tenants/') && currentPath !== 'tenants/onboard') {
      return [
        { label: 'Dashboard', path: '' },
        { label: 'PLATFORM' },
        { label: 'Tenants', path: 'tenants' },
        { label: 'Tenant Detail' },
      ]
    }
    if (currentPath.startsWith('vitals-monitor/')) {
      return [
        { label: 'Dashboard', path: '' },
        { label: 'MEDICAL' },
        { label: 'Vitals Monitor', path: 'vitals-monitor' },
        { label: 'Patient Detail' },
      ]
    }
    return [{ label: 'Dashboard', path: '' }]
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-full bg-slate-800 text-slate-300 transition-all duration-300 z-40 flex flex-col"
        style={{ width: sidebarCollapsed ? '4rem' : '16.25rem' }}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-slate-700">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                Z4
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Zenzers 4Life</div>
                <div className="text-xs text-slate-400">Admin Console</div>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto">
              Z4
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="py-2 flex-1 overflow-y-auto">
          {navigation.map((section, sIdx) => (
            <div key={sIdx} className="mb-1">
              {section.title && !sidebarCollapsed && (
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.title && sidebarCollapsed && (
                <div className="border-t border-slate-700 my-1 mx-2" />
              )}
              {section.items.map((item) => {
                const isActive = currentPath === item.path
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white',
                      sidebarCollapsed && 'justify-center px-2',
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                    end={item.path === ''}
                  >
                    <i className={clsx('pi', item.icon, 'text-base')} />
                    {!sidebarCollapsed && (
                      <span className="flex-1">{item.label}</span>
                    )}
                    {!sidebarCollapsed && item.phase && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                        {item.phase}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Theme Switcher — pinned to bottom */}
        <ThemeSwitcher collapsed={sidebarCollapsed} />
      </aside>

      {/* Main content area */}
      <div
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? '4rem' : '16.25rem' }}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <i className={clsx('pi', sidebarCollapsed ? 'pi-bars' : 'pi-times')} />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1 text-sm text-slate-500">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <i className="pi pi-chevron-right text-xs text-slate-300" />}
                  <span className={i === breadcrumbs.length - 1 ? 'text-slate-800 font-medium' : ''}>
                    {crumb.label}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {user?.profile?.email ?? 'Admin'}
            </span>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Sign out"
            >
              <i className="pi pi-sign-out" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
