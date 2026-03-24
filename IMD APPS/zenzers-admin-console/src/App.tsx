import React, { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { PermissionGuard } from './auth/PermissionGuard'
import { useAdminAuth } from './auth/useAdminAuth'
import { setAuthTokenProvider } from './api/client'

// Lazy-loaded pages — Auth (public, pre-auth gate)
const AdminForgotPasswordPage = lazy(() => import('./pages/auth/AdminForgotPasswordPage').then(m => ({ default: m.AdminForgotPasswordPage })))
const AdminResetPasswordPage = lazy(() => import('./pages/auth/AdminResetPasswordPage').then(m => ({ default: m.AdminResetPasswordPage })))

// Lazy-loaded pages — Core
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })))

// Lazy-loaded pages — AI & Automation
const AIModelsPage = lazy(() => import('./pages/ai-models/AIModelsPage').then(m => ({ default: m.AIModelsPage })))
const WorkflowsPage = lazy(() => import('./pages/workflows/WorkflowsPage').then(m => ({ default: m.WorkflowsPage })))
const JobsPage = lazy(() => import('./pages/jobs/JobsPage').then(m => ({ default: m.JobsPage })))
const FeatureFlagsPage = lazy(() => import('./pages/feature-flags/FeatureFlagsPage').then(m => ({ default: m.FeatureFlagsPage })))
const WorkersPage = lazy(() => import('./pages/workers/WorkersPage').then(m => ({ default: m.WorkersPage })))

// Lazy-loaded pages — Platform
const TenantsPage = lazy(() => import('./pages/tenants/TenantsPage').then(m => ({ default: m.TenantsPage })))
const TenantOnboardingWizard = lazy(() => import('./pages/tenants/TenantOnboardingWizard').then(m => ({ default: m.TenantOnboardingWizard })))
const TenantDetailPage = lazy(() => import('./pages/tenants/TenantDetailPage').then(m => ({ default: m.TenantDetailPage })))
const CMSPage = lazy(() => import('./pages/cms/CMSPage').then(m => ({ default: m.CMSPage })))
const CMSEditorPage = lazy(() => import('./pages/cms/CMSEditorPage').then(m => ({ default: m.CMSEditorPage })))
const AuthSettingsPage = lazy(() => import('./pages/auth-settings/AuthSettingsPage').then(m => ({ default: m.AuthSettingsPage })))
const AuditLogPage = lazy(() => import('./pages/audit-log/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const RateLimitsPage = lazy(() => import('./pages/rate-limits/RateLimitsPage').then(m => ({ default: m.RateLimitsPage })))
const ContentPolicyPage = lazy(() => import('./pages/content-policy/ContentPolicyPage').then(m => ({ default: m.ContentPolicyPage })))
const FraudDetectionPage = lazy(() => import('./pages/fraud-detection/FraudDetectionPage').then(m => ({ default: m.FraudDetectionPage })))
const MessagingPage = lazy(() => import('./pages/messaging/MessagingPage').then(m => ({ default: m.MessagingPage })))
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))

// Lazy-loaded pages — Retained
const PricingPage = lazy(() => import('./pages/pricing/PricingPage').then(m => ({ default: m.PricingPage })))
const SupportPage = lazy(() => import('./pages/support/SupportPage').then(m => ({ default: m.SupportPage })))
const KnowledgeBasePage = lazy(() => import('./pages/knowledge-base/KnowledgeBasePage').then(m => ({ default: m.KnowledgeBasePage })))
const CustomAgentsPage = lazy(() => import('./pages/custom-agents/CustomAgentsPage').then(m => ({ default: m.CustomAgentsPage })))
const AISettingsPage = lazy(() => import('./pages/ai-settings/AISettingsPage').then(m => ({ default: m.AISettingsPage })))
const PromptTemplatesPage = lazy(() => import('./pages/prompt-templates/PromptTemplatesPage').then(m => ({ default: m.PromptTemplatesPage })))
const AuditLogDashboardPage = lazy(() => import('./pages/audit-log/AuditLogDashboardPage').then(m => ({ default: m.AuditLogDashboardPage })))
const LoginAuditPage = lazy(() => import('./pages/login-audit/LoginAuditPage').then(m => ({ default: m.LoginAuditPage })))
const NetworkSettingsPage = lazy(() => import('./pages/network/NetworkSettingsPage').then(m => ({ default: m.NetworkSettingsPage })))
const VersionControlPage = lazy(() => import('./pages/version-control/VersionControlPage').then(m => ({ default: m.VersionControlPage })))
const DevWikiPage = lazy(() => import('./pages/dev-wiki/DevWikiPage').then(m => ({ default: m.DevWikiPage })))
const DatabasePage = lazy(() => import('./pages/database/DatabasePage').then(m => ({ default: m.DatabasePage })))
const AccessControlPage = lazy(() => import('./pages/access-control/AccessControlPage').then(m => ({ default: m.AccessControlPage })))
const CredentialsPage = lazy(() => import('./pages/credentials/CredentialsPage').then(m => ({ default: m.CredentialsPage })))
const OTPSettingsPage = lazy(() => import('./pages/otp-settings/OTPSettingsPage').then(m => ({ default: m.OTPSettingsPage })))
const SEOPage = lazy(() => import('./pages/seo/SEOPage').then(m => ({ default: m.SEOPage })))
const DomainsPage = lazy(() => import('./pages/domains/DomainsPage').then(m => ({ default: m.DomainsPage })))

// Lazy-loaded pages — Commerce
const ChatManagementPage = lazy(() => import('./pages/chat/ChatManagementPage').then(m => ({ default: m.ChatManagementPage })))
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage').then(m => ({ default: m.OrdersPage })))
const PaymentGatewaysPage = lazy(() => import('./pages/payment-gateways/PaymentGatewaysPage').then(m => ({ default: m.PaymentGatewaysPage })))
const ShopPage = lazy(() => import('./pages/shop/ShopPage').then(m => ({ default: m.ShopPage })))
const ProductEditPage = lazy(() => import('./pages/shop/ProductEditPage').then(m => ({ default: m.ProductEditPage })))
const ShippingPage = lazy(() => import('./pages/shipping/ShippingPage').then(m => ({ default: m.ShippingPage })))
const ManufacturingPage = lazy(() => import('./pages/manufacturing/ManufacturingPage').then(m => ({ default: m.ManufacturingPage })))
const PromoCodesPage = lazy(() => import('./pages/promo-codes/PromoCodesPage').then(m => ({ default: m.PromoCodesPage })))
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })))
const InvoicesPage = lazy(() => import('./pages/invoices/InvoicesPage').then(m => ({ default: m.InvoicesPage })))
const TaxExemptionsPage = lazy(() => import('./pages/tax-exemptions/TaxExemptionsPage').then(m => ({ default: m.TaxExemptionsPage })))
const CartAbandonmentPage = lazy(() => import('./pages/cart-abandonment/CartAbandonmentPage').then(m => ({ default: m.CartAbandonmentPage })))
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage').then(m => ({ default: m.CustomersPage })))
const CRMPage = lazy(() => import('./pages/crm/CRMPage').then(m => ({ default: m.CRMPage })))

// Lazy-loaded pages — Ranking & Leads
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage').then(m => ({ default: m.LeadsPage })))
const LeadFormsPage = lazy(() => import('./pages/lead-forms/LeadFormsPage').then(m => ({ default: m.LeadFormsPage })))
const CampaignsPage = lazy(() => import('./pages/campaigns/CampaignsPage').then(m => ({ default: m.CampaignsPage })))
const LeadScoringPage = lazy(() => import('./pages/lead-scoring/LeadScoringPage').then(m => ({ default: m.LeadScoringPage })))

// Lazy-loaded pages — Development
const RepairPlansPage = lazy(() => import('./pages/repair-plans/RepairPlansPage').then(m => ({ default: m.RepairPlansPage })))
const AdminProfilePage = lazy(() => import('./pages/profile/AdminProfilePage').then(m => ({ default: m.AdminProfilePage })))

// Lazy-loaded pages — Medical
const PatientsPage = lazy(() => import('./pages/patients/PatientsPage').then(m => ({ default: m.PatientsPage })))
const DoctorsPage = lazy(() => import('./pages/doctors/DoctorsPage').then(m => ({ default: m.DoctorsPage })))
const CaregiversPage = lazy(() => import('./pages/caregivers/CaregiversPage').then(m => ({ default: m.CaregiversPage })))
const VitalsMonitorPage = lazy(() => import('./pages/vitals-monitor/VitalsMonitorPage').then(m => ({ default: m.VitalsMonitorPage })))
const PatientDetailPage = lazy(() => import('./pages/vitals-monitor/PatientDetailPage').then(m => ({ default: m.PatientDetailPage })))
const MedicalRecordsPage = lazy(() => import('./pages/medical-records/MedicalRecordsPage').then(m => ({ default: m.MedicalRecordsPage })))
const EmergencyContactsPage = lazy(() => import('./pages/emergency-contacts/EmergencyContactsPage').then(m => ({ default: m.EmergencyContactsPage })))
const DataAccessPage = lazy(() => import('./pages/data-access/DataAccessPage').then(m => ({ default: m.DataAccessPage })))
const GatewayDevicesPage = lazy(() => import('./pages/gateway-devices/GatewayDevicesPage').then(m => ({ default: m.GatewayDevicesPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <i className="pi pi-spin pi-spinner text-3xl text-blue-500" />
    </div>
  )
}

class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('Loading CSS chunk')

      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center p-6 max-w-sm">
            <i className={`pi ${isChunkError ? 'pi-wifi' : 'pi-exclamation-triangle'} text-3xl text-amber-500 mb-3`} />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">
              {isChunkError ? 'Connection Lost' : 'Something went wrong'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {isChunkError
                ? 'Failed to load page. Check your connection and try again.'
                : 'An unexpected error occurred.'}
            </p>
            <button onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const { isAuthenticated, isLoading, login, getAccessToken } = useAdminAuth()

  useEffect(() => {
    setAuthTokenProvider(getAccessToken)
  }, [getAccessToken])

  // Public routes (before auth gate)
  const path = window.location.pathname
  if (path === '/admin/forgot-password' || path === '/admin/reset-password') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/forgot-password" element={<AdminForgotPasswordPage />} />
          <Route path="/reset-password" element={<AdminResetPasswordPage />} />
        </Routes>
      </Suspense>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <i className="pi pi-spin pi-spinner text-4xl text-blue-500" />
          <p className="mt-4 text-slate-600">Loading Admin Console...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Zenzers 4Life</h1>
          <p className="text-slate-500 mb-6">Medical Admin Console</p>
          <button
            onClick={login}
            style={{ backgroundColor: '#2563eb', color: '#fff' }}
            className="px-6 py-3 rounded-lg transition-colors font-medium hover:opacity-90"
          >
            Sign in with Keycloak
          </button>
          <a href="/admin/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-800 mt-3 inline-block">
            Forgot your password?
          </a>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard requiredRole="platform-operator">
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AdminLayout />}>
            {/* Dashboard */}
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<AdminProfilePage />} />

            {/* Platform */}
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="tenants/onboard" element={<TenantOnboardingWizard />} />
            <Route path="tenants/:id" element={<TenantDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="domains" element={<DomainsPage />} />

            {/* Medical */}
            <Route path="patients" element={<PatientsPage />} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="caregivers" element={<CaregiversPage />} />
            <Route path="vitals-monitor" element={<VitalsMonitorPage />} />
            <Route path="vitals-monitor/:patientId" element={<PatientDetailPage />} />

            {/* Medical Tools */}
            <Route path="medical-records" element={<MedicalRecordsPage />} />
            <Route path="emergency-contacts" element={<EmergencyContactsPage />} />
            <Route path="data-access" element={<DataAccessPage />} />
            <Route path="gateway-devices" element={<GatewayDevicesPage />} />

            {/* Users & Auth */}
            <Route path="access-control" element={<AccessControlPage />} />
            <Route path="authentication" element={<AuthSettingsPage />} />
            <Route path="otp-settings" element={<OTPSettingsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="tenant-audit-log" element={<AuditLogDashboardPage />} />
            <Route path="login-audit" element={<LoginAuditPage />} />
            <Route path="tenant-login-audit" element={<LoginAuditPage />} />

            {/* Content */}
            <Route path="cms" element={<CMSPage />} />
            <Route path="cms/new" element={<CMSEditorPage />} />
            <Route path="cms/:id/edit" element={<CMSEditorPage />} />
            <Route path="knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="messaging" element={<MessagingPage />} />
            <Route path="chat" element={<ChatManagementPage />} />

            {/* Operations */}
            <Route path="database" element={<DatabasePage />} />
            <Route path="feature-flags" element={<FeatureFlagsPage />} />
            <Route path="credentials" element={<CredentialsPage />} />
            <Route path="network" element={<NetworkSettingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />

            {/* AI & Automation */}
            <Route path="ai-models" element={<AIModelsPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="ai-settings" element={<AISettingsPage />} />
            <Route path="custom-agents" element={<CustomAgentsPage />} />
            <Route path="prompt-templates" element={<PromptTemplatesPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="workers" element={<WorkersPage />} />

            {/* Security */}
            <Route path="fraud-detection" element={<FraudDetectionPage />} />
            <Route path="content-policy" element={<ContentPolicyPage />} />
            <Route path="rate-limits" element={<RateLimitsPage />} />

            {/* Commerce */}
            <Route path="orders" element={<OrdersPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="payment-gateways" element={<PaymentGatewaysPage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="shop/:id/edit" element={<ProductEditPage />} />
            <Route path="shipping" element={<ShippingPage />} />
            <Route path="manufacturing" element={<ManufacturingPage />} />
            <Route path="promo-codes" element={<PromoCodesPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="tax-exemptions" element={<TaxExemptionsPage />} />
            <Route path="cart-recovery" element={<CartAbandonmentPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="crm" element={<CRMPage />} />

            {/* Ranking */}
            <Route path="seo" element={<SEOPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="lead-forms" element={<LeadFormsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="lead-scoring" element={<LeadScoringPage />} />

            {/* Development */}
            <Route path="support" element={<SupportPage />} />
            <Route path="repair-plans" element={<RepairPlansPage />} />
            <Route path="version-control" element={<VersionControlPage />} />
            <Route path="dev-wiki" element={<DevWikiPage />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    </PermissionGuard>
  )
}

export default App
