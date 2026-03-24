import { api } from './client'

// Types
export interface DashboardStats {
  tenantCount: number
  userCount: number
  activeJobs: number
  systemHealth: 'healthy' | 'degraded' | 'down'
  recentActivity: ActivityItem[]
}

export interface ActivityItem {
  id: string
  userId: string
  userEmail: string
  action: string
  resourceType: string
  resourceId: string
  timestamp: string
}

export interface AuditLogEntry {
  id: string
  userId: string
  userEmail: string
  action: string
  method: string
  path: string
  resourceType: string
  resourceId: string
  payloadHash: string
  statusCode: number
  ipAddress: string
  userAgent: string
  durationMs: number
  timestamp: string
}

export interface AuditLogQuery {
  page?: string
  limit?: string
  userId?: string
  action?: string
  resourceType?: string
  from?: string
  to?: string
}

export interface AuditLogStats {
  totalEntries: number
  today: number
  thisWeek: number
  uniqueUsers: number
  byMethod: Record<string, number>
  topResources: { resource: string; count: number }[]
  recentErrors: number
}

export interface LoginAuditEntry {
  id: string
  userId: string | null
  email: string | null
  name: string | null
  role: string | null
  event: string
  status: string
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
  details: string | null
}

export interface LoginAuditStats {
  totalEvents: number
  todayLogins: number
  failedLogins7d: number
  uniqueUsers: number
  byEvent: Record<string, number>
  activeSessionCount: number
}

export interface EmailLogEntry {
  id: string
  recipient: string[]
  subject: string | null
  templateSlug: string | null
  reason: string | null
  status: string
  provider: string
  sentAt: string
  error: string | null
}

export interface EmailLogStats {
  totalSent: number
  todaySent: number
  failedCount: number
  uniqueRecipients: number
  byReason: { reason: string; count: number }[]
  byTemplate: { template: string; count: number }[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// --- Multi-tenancy Types ---

export interface OrgRole {
  id: string
  key: string
  label: string
  description: string
  permissions: string[]
  isOwnerRole: boolean
  isDefault: boolean
}

export interface TenantCourse {
  id: string
  name: string
  description?: string
  createdBy: string
  memberCount?: number
  members?: CourseMember[]
  createdAt: string
  updatedAt: string
}

export interface CourseMember {
  sub: string
  role: string
  addedAt: string
}

export interface OnboardedTenant {
  organizationId: string
  slug: string
  name: string
  plan: string
  contactEmail: string
  minioBucket: string
  featureFlags: Record<string, boolean>
  quotas: {
    maxProjects: number
    maxStorageMb: number
    maxMembersCount: number
    maxCrownGenerationsPerMonth: number
    maxSegmentationsPerMonth: number
  }
  createdAt: string
}

// --- Org Type Registry Types ---

export interface OrgTypeRoleTemplate {
  key: string
  label: string
  description: string
  permissions: string[]
  isOwnerRole: boolean
  isDefault: boolean
}

export interface OrgTypeSpecialBehavior {
  autoEnterprise?: boolean
  allPermissions?: boolean
  allFlags?: boolean
  extraFlags?: string[]
  courseEligible?: boolean
  manufacturerOrderRouting?: boolean
}

export interface OrgTypeInfo {
  key: string
  label: string
  description: string
  icon: string
  color: string
  activeColor: string
  badgeColor: string
  defaultRoles: OrgTypeRoleTemplate[]
  featureFlagOverrides: Record<string, Record<string, boolean>>
  specialBehavior?: OrgTypeSpecialBehavior
}

export interface OrgTypesResponse {
  data: OrgTypeInfo[]
  permissions: string[]
  total: number
}

// --- Phase B Types ---

export interface AIModel {
  id: string
  name: string
  engineType: string
  description: string
  dockerImage: string
  config: Record<string, unknown>
  status: 'active' | 'inactive' | 'deprecated'
  versions: AIModelVersion[]
  activeVersion: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface AIModelVersion {
  tag: string
  status: 'active' | 'inactive'
  config: Record<string, unknown>
  createdAt: string
  activatedAt?: string
}

export interface CreateAIModelPayload {
  name: string
  engineType: string
  description?: string
  dockerImage?: string
  config?: Record<string, unknown>
}

export interface Workflow {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'draft'
  trigger: 'manual' | 'event' | 'schedule'
  triggerConfig: Record<string, unknown>
  steps: WorkflowStep[]
  executionCount: number
  failureCount: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface WorkflowStep {
  id: string
  type: 'ai-model' | 'notification' | 'webhook' | 'condition'
  name: string
  config: Record<string, unknown>
  dependsOn: string[]
  order: number
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt: string | null
  triggeredBy: string
  stepResults: WorkflowStepResult[]
}

export interface WorkflowStepResult {
  stepId: string
  stepName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  output: unknown
  startedAt: string | null
  completedAt: string | null
}

export interface Job {
  id: string
  projectId: string
  projectName?: string
  jobType: string
  status: string
  duration?: number
  timestamp?: string
  startedAt?: string
  message?: string
  cause?: string
  engineVersion?: string
  tooth?: string
  arch?: string
}

export interface JobStats {
  byType: Record<string, { total: number; byStatus: Record<string, { count: number; avgDuration: number }> }>
  totalCrownGenerations: number
}

export interface WorkerQueue {
  name: string
  jobType: string
  service: string
  replicas: number
  gpu: boolean
  timeoutSeconds: number
  engineImage: string | null
  backend: 'celery' | 'pika'
}

export interface WorkerStatus {
  mode: 'celery' | 'pika' | 'hybrid'
  queues: WorkerQueue[]
  queueOverrides: Record<string, 'celery' | 'pika'> | null
  updatedAt: string | null
}

export interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string
  enabled: boolean
  rolloutPercentage: number
  tenantOverrides: Record<string, boolean>
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateFeatureFlagPayload {
  key: string
  name: string
  description?: string
  enabled?: boolean
  rolloutPercentage?: number
}

// --- Phase D Types ---

export interface PricingPlan {
  id: string
  name: string
  type: 'subscription' | 'per-scan' | 'enterprise'
  currency: string
  interval: 'monthly' | 'yearly' | 'one-time'
  price: number
  features: string[]
  limits: { scansPerMonth: number; crownGensPerMonth: number; storageGB: number }
  addOns: string[]
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PaymentGateway {
  id: string
  provider: string
  displayName: string
  mode: 'test' | 'live'
  isEnabled: boolean
  config: Record<string, unknown> & { secretKeySet?: boolean; webhookSecretSet?: boolean; apiSecretSet?: boolean }
  supportedCurrencies: string[]
  supportedMethods: string[]
  lastTestedAt: string | null
  testResult: { success: boolean; message: string; testedAt: string } | null
  createdAt: string
  updatedAt: string
}

export interface ShopSettings {
  storeName: string
  currency: string
  taxEnabled: boolean
  taxRate: number
  taxLabel: string
  termsUrl: string
  supportEmail: string
}

export interface ProductImage {
  id: string
  key: string
  originalName: string
  mimeType: string
  size: number
  altText: string
  isPrimary: boolean
  sortOrder: number
  uploadedAt: string
}

export interface ProductDental {
  crownMaterial: string | null
  restorationType: string | null
  workflow: string | null
  brandName: string | null
  partNumber: string | null
  useCase: string | null
  dosePerCrown: number | null
  doseUnit: string | null
  isOptional: boolean
}

export interface Product {
  id: string
  name: string
  sku: string
  type: 'digital-service' | 'physical' | 'pod' | 'mod'
  category: string
  channel: 'main-shop' | 'upsell-addon'
  description: string
  price: number
  bulkPrice: number | null
  bulkMinQty: number | null
  currency: string
  dosePerUnit: string | null
  packSizeInfo: string | null
  packQty: number | null
  isActive: boolean
  pricingPlanId: string | null
  manufacturerId: string | null
  images: ProductImage[]
  dental: ProductDental | null
  upsellGroups: string[]
  createdAt: string
  updatedAt: string
}

export interface UpsellGroup {
  label: string
  parentMaterials: string[]
  workflow: string
}

export interface UpsellSuggestion {
  groups: Array<{ key: string; label: string; parentMaterials: string[]; workflow: string }>
  consumables: Array<Product & { costPerCrown: number }>
  totalRequired: number
  totalWithOptional: number
}

export interface AiAssistRequest {
  field: 'name' | 'description'
  action: 'generate' | 'refine' | 'add-disclaimers'
  currentValue?: string
  productContext?: {
    category?: string
    crownMaterial?: string
    restorationType?: string
    workflow?: string
    brandName?: string
  }
}

export interface AiAssistResponse {
  generatedText: string
}

export interface ShippingSettings {
  origin: { street: string; city: string; state: string; zip: string; country: string }
  carriers: ShippingCarrier[]
  zones: ShippingZone[]
  rates: ShippingRate[]
}

export interface ShippingCarrier {
  id: string
  name: string
  isEnabled: boolean
  accountNumber: string
}

export interface ShippingZone {
  id: string
  name: string
  countries: string[]
}

export interface ShippingRate {
  id: string
  zoneId: string
  carrierId: string
  method: string
  flatRate: number
  freeAbove: number | null
  estimatedDays: number | null
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string | null
  customerEmail: string
  status: string
  items: OrderItem[]
  subtotal: number
  tax: number
  shippingCost: number
  discount: number
  total: number
  paymentGateway: string | null
  paymentStatus: string
  shippingAddress: Record<string, string> | null
  trackingNumber: string | null
  manufacturerId: string | null
  manufacturingStatus: string | null
  notes: { text: string; createdBy: string; createdAt: string }[]
  statusHistory: { status: string; timestamp: string; changedBy: string }[]
  refundAmount: number
  refundReason: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  productName: string
  sku: string
  type: string
  quantity: number
  unitPrice: number
  total: number
  projectId: string | null
  jobType: string | null
  toothNumber: string | null
  material: string | null
}

export interface OrderStats {
  totalOrders: number
  todayOrders: number
  totalRevenue: number
  byStatus: Record<string, number>
  pendingOrders: number
}

export interface Manufacturer {
  id: string
  name: string
  type: 'in-house' | 'partner' | 'pod'
  status: 'active' | 'inactive' | 'onboarding'
  contactEmail: string
  capabilities: string[]
  materials: string[]
  leadTimeDays: { min: number; max: number }
  pricing: { capability: string; material: string; unitPrice: number }[]
  address: Record<string, string>
  notes: string
  activeOrderCount?: number
  createdAt: string
  updatedAt: string
}

export interface ManufacturingQueueGroup {
  manufacturerId: string | null
  manufacturerName: string
  count: number
  orders: { id: string; orderNumber: string; status: string; items: OrderItem[]; createdAt: string }[]
}

export interface Customer {
  id: string
  userId: string
  userName: string
  userEmail: string
  tags: string[]
  notes: { id: string; text: string; createdBy: string; createdAt: string }[]
  lifetimeValue: number
  orderCount: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  segment: 'new' | 'active' | 'returning' | 'at-risk' | 'churned'
  createdAt: string
  updatedAt: string
}

export interface CustomerStats {
  totalCustomers: number
  newThisMonth: number
  totalLTV: number
  avgLTV: number
  bySegment: Record<string, number>
}

export interface CohortData {
  month: string
  customers: number
  avgLTV: number
  avgOrders: number
}

export interface SupportAttachment {
  fileId: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
}

export interface SupportMessage {
  messageId?: string
  sender: string
  senderType: string
  messageType?: 'reply' | 'internal-note' | 'system-event'
  body: string
  attachments?: SupportAttachment[]
  createdAt: string
}

export interface RepairPlan {
  id: string
  ticketId: string
  ticketNumber: string
  ticketSubject?: string
  planBody: string
  version: number
  status: 'draft' | 'approved' | 'rejected' | 'superseded'
  generatedBy: string
  generatedByEmail?: string | null
  generationPath?: string | null
  model: string
  tokensUsed: number
  promptTokens?: number
  completionTokens?: number
  durationMs?: number
  correctionInstructions: string | null
  parentPlanId: string | null
  createdAt: string
  updatedAt: string
}

export interface SupportTicket {
  id: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  category: string
  customerId: string | null
  customerEmail: string
  assignedTo: string | null
  messages: SupportMessage[]
  attachmentCount: number
  sla: { responseDeadline: string; resolutionDeadline: string; breached: boolean }
  tags: string[]
  punchlist?: {
    relevance: string
    gapCodes: string[]
    comments: string
    assessedAt: string
  }
  createdAt: string
  updatedAt: string
}

export interface SupportStats {
  total: number
  open: number
  waitingCustomer: number
  waitingInternal: number
  resolved: number
  breached: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
}

export interface SupportConfig {
  slaDefaults: Record<string, { responseHours: number; resolutionHours: number }>
  cannedResponses: { id?: string; label: string; body: string }[]
  autoAssignEnabled: boolean
  categories: string[]
}

// --- Email Template Types ---

export interface EmailTemplate {
  id: string
  slug: string
  name: string
  subject: string
  htmlBody: string
  variables: { key: string; description: string; required: boolean }[]
  category: 'transactional' | 'notification' | 'marketing'
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

// --- Chat Management Types ---

export interface ChatConversation {
  id: string
  ticketNumber: string
  customerName: string
  customerEmail: string
  status: string
  chatContext: string | null
  needsHumanReview: boolean
  assignedTo: string | null
  lastMessage: { sender: string; senderType: string; body: string; createdAt: string } | null
  messages?: { messageId: string; sender: string; senderType: string; body: string; createdAt: string }[]
  createdAt: string
  updatedAt: string
}

export interface ChatStats {
  totalChats: number
  activeChats: number
  botHandled: number
  humanHandled: number
  needsReview: number
}

// --- Admin Credits Types ---

export interface AdminProfile {
  id: string
  sub: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  timezone?: string
  avatarKey?: string
  professional?: {
    licenseNumber?: string
    specialty?: string
  }
  profileCompleteness?: number
  twoFactorEnabled?: boolean
  lastLogin?: string
  createdAt?: string
}

export interface AdminCreditOverview {
  totalOrgs: number
  totalBalance: number
  totalLifetimePurchased: number
  totalLifetimeUsed: number
  recentTransactions: AdminLedgerEntry[]
}

export interface AdminLedgerEntry {
  type: string
  amount: number
  balance: number
  description: string
  jobType: string | null
  organizationId: string
  createdAt: string
  createdBy: string
}

export interface AdminOrgCredits {
  balance: number
  lifetimePurchased: number
  lifetimeUsed: number
  history: AdminLedgerEntry[]
  total: number
}

// --- Phase E Types ---

export interface KnowledgeBaseArticle {
  id: string
  title: string
  slug: string
  body: string
  category: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  author: string
  publishedAt: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CustomAgent {
  id: string
  name: string
  description: string
  systemPrompt: string
  modelId: string
  temperature: number
  maxTokens: number
  tools: { name: string; description: string; config: Record<string, unknown> }[]
  isActive: boolean
  version: number
  context?: string
  knowledgeBaseCategories?: string[]
  knowledgeBaseArticleIds?: string[]
  greetingMessage?: string
  escalationEnabled?: boolean
  escalationMessage?: string
  tags?: string[]
  providerId?: string | null
  providerName?: string
  bindings?: {
    chats: string[]
    pages: string[]
    widgets: string[]
    workflows: string[]
    databases: string[]
  }
  responseFormat?: 'text' | 'json' | 'markdown'
  skillIds?: string[]
  category?: 'system' | 'support' | 'chat' | 'workflow' | 'custom'
  isSystemAgent?: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface AIProvider {
  id: string
  name: string
  vendor: string
  baseUrl: string
  apiKeySet: boolean
  apiKeyMasked: string | null
  models: string[]
  selectedModel: string
  isActive: boolean
  capabilities: {
    chat: boolean
    embeddings: boolean
    images: boolean
    json_mode: boolean
    function_calling: boolean
  }
  rateLimits: { requestsPerMinute: number; tokensPerMinute: number }
  usageStats: { totalRequests: number; totalTokens: number; lastUsedAt: string | null }
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface AIProviderName {
  id: string
  name: string
  vendor: string
  selectedModel: string
}

export interface AIProviderTestResult {
  success: boolean
  latencyMs: number
  model?: string
  vendor?: string
  error?: string
}

export interface AgentSkill {
  id: string
  name: string
  slug: string
  description: string
  category: string
  type: 'prompt-injection' | 'data-fetch' | 'tool-call' | 'composite' | 'markdown'
  body?: string
  config?: {
    promptTemplate?: string
    collection?: string
    queryTemplate?: Record<string, unknown>
    fields?: string[]
    maxResults?: number
    toolDefinition?: { name: string; description: string; parameters: Record<string, unknown> }
    childSkillIds?: string[]
  }
  dataAccess?: {
    collections: string[]
    allowedFields: Record<string, string[]>
    writeAccess: boolean
  }
  tags: string[]
  isActive: boolean
  version: number
  agentCount?: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface AgentTestResult {
  agentId: string
  agentName: string
  modelId: string
  input: string
  output: string
  tokensUsed: number
  latencyMs: number
  timestamp: string
}

export interface MarketplaceProvider {
  id: string
  name: string
  type: 'model' | 'tool' | 'dataset'
  description: string
  vendor: string
  version: string
  pricing: { model: string; amount: number; currency: string }
  apiKeyRequired: boolean
  apiKeySet: boolean
  apiKeyMasked: string | null
  configSchema: Record<string, unknown>
  config: Record<string, unknown>
  isEnabled: boolean
  installCount: number
  rating: number
  iconUrl: string | null
  documentationUrl: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface MarketplaceStats {
  total: number
  enabled: number
  disabled: number
  byType: Record<string, number>
}

export interface MarketplaceUsage {
  id: string
  providerId: string
  action: string
  tokensUsed: number
  cost: number
  createdAt: string
}

export interface AISettings {
  globalProvider: {
    provider: string
    apiKeySet?: boolean
    apiKeyMasked?: string | null
    baseUrl: string
    defaultModel: string
    temperature: number
    maxTokens: number
  }
  taskDefaults: Record<string, { modelId: string; temperature: number; maxTokens: number; timeout: number }>
  rateLimits: {
    requestsPerMinute: number
    requestsPerHour: number
    tokensPerMinute: number
    tokensPerDay: number
  }
  costTracking: {
    enabled: boolean
    alertThreshold: number
    alertEmail: string
    monthlyBudget: number
  }
  updatedAt?: string
}

export interface AIUsageSummary {
  period: { start: string; end: string }
  totalRequests: number
  totalTokens: number
  totalCost: number
}

// --- Phase F Types ---

export interface NetworkSettings {
  devServer: {
    host: string
    port: number
    https: boolean
    allowedOrigins: string[]
  }
  ipSettings: {
    whitelist: string[]
    blacklist: string[]
    mode: 'allow-all' | 'whitelist' | 'blacklist'
  }
  tunnels: NetworkTunnel[]
  dns: {
    primaryDns: string
    secondaryDns: string
    customDomains: string[]
  }
  updatedAt?: string
}

export interface NetworkTunnel {
  id: string
  name: string
  type: 'ssh' | 'ngrok' | 'cloudflare'
  host: string
  port: number
  isActive: boolean
  createdAt: string
}

export interface NetworkDiagnostics {
  timestamp: string
  checks: { name: string; status: string; latencyMs: number }[]
  allHealthy: boolean
}

export interface VersionInfo {
  version: string
  branch: string
  commit: string
  environment: string
  buildDate: string | null
}

export interface Deployment {
  id: string
  version: string
  environment: 'staging' | 'production'
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled-back'
  commit: string
  branch: string
  deployedBy: string
  deployedAt: string | null
  rollbackOf: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface DevWikiPage {
  id: string
  title: string
  slug: string
  body: string
  section: string
  sortOrder: number
  author: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface PromptTemplate {
  id: string
  name: string
  slug: string
  prompt: string
  category: string
  variables: string[]
  model: string
  temperature: number
  maxTokens: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DatabaseStats {
  dbName: string
  collections: number
  dataSize: number
  storageSize: number
  indexes: number
  indexSize: number
  avgObjSize: number
  objects: number
}

export interface CollectionInfo {
  name: string
  type: string
  count: number
  size: number
  storageSize: number
  avgObjSize: number
  indexes: number
}

export interface DbBackup {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  type: 'full' | 'mongo-only' | 'pg-only'
  sizeBytes: number
  collections: number
  createdBy: string
  createdAt: string
  completedAt?: string
  startedAt?: string
  duration?: number
  path?: string
  error?: string
  restoreStatus?: 'pending' | 'running' | 'completed' | 'failed'
  restoreError?: string
  notes: string
}

export interface BackupSchedule {
  enabled: boolean
  intervalMs: number
  retentionDays: number
  maxBackups: number
  type: 'full' | 'mongo-only' | 'pg-only'
  lastRun: string | null
  nextRun: string | null
  createdBy: string
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface Permission {
  id: string
  key: string
  group: string
  description: string
}

export interface CredentialUsage {
  module: string
  field: string
  file: string
}

export interface Credential {
  id: string
  name: string
  envKey: string | null
  type: 'api-key' | 'token' | 'password' | 'certificate' | 'other'
  service: string
  valueMasked: string
  hasValue: boolean
  description: string
  usedIn: CredentialUsage[]
  expiresAt: string | null
  isActive: boolean
  lastRotatedAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

// --- Fraud Detection Types ---

export interface FraudEvent {
  id: string
  type: string
  source: string
  ip: string | null
  userId: string | null
  userEmail: string | null
  status: 'flagged' | 'review' | 'blocked' | 'dismissed'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  createdAt: string
}

export interface FraudStats {
  flaggedToday: number
  underReview: number
  blocked: number
}

export interface FraudBlocklistIP {
  id: string
  value: string
  reason: string
  createdAt: string
  createdBy: string
}

export interface FraudBlocklistUser {
  id: string
  userId: string
  userEmail: string
  reason: string
  createdAt: string
  createdBy: string
}

export interface FraudRule {
  id: string
  name: string
  description: string
  source: string
  active: boolean
  ruleCount: number
}

// --- Notification Types ---

export interface NotificationChannel {
  key: string
  label: string
  description: string
  enabled: boolean
  methods: string[]
}

export interface NotificationConfig {
  channels: NotificationChannel[]
  webhookUrl: string | null
  slackWebhookUrl: string | null
  adminEmails: string[]
  updatedAt: string | null
}

// --- Service Health Types ---

export interface ServiceHealthItem {
  name: string
  description: string
  status: 'healthy' | 'down' | 'degraded'
  latencyMs: number
  checkType?: string
  category?: string
  telemetry?: {
    uptimePercent: number
    avgLatencyMs: number
    maxLatencyMs: number
    minLatencyMs: number
    checkCount: number
  }
}

export interface ServiceHealthResponse {
  services: ServiceHealthItem[]
  allHealthy: boolean
  total: number
  healthy: number
  checkedAt: string
}

// Admin API endpoints
export const adminApi = {
  // Dashboard
  getDashboardStats: () => api.get<DashboardStats>('/admin/dashboard'),

  // Audit Log
  getAuditLog: (query: AuditLogQuery) =>
    api.get<PaginatedResponse<AuditLogEntry>>('/admin/audit-log', query as Record<string, string>),
  getAuditLogStats: () => api.get<AuditLogStats>('/admin/audit-log/stats'),

  // Settings
  getSettings: () => api.get<Record<string, unknown>>('/admin/settings'),
  updateSettings: (settings: Record<string, unknown>) =>
    api.put<Record<string, unknown>>('/admin/settings', settings),

  // Users (admin route — bypasses legacy RBAC)
  getUsers: () => api.get<unknown[]>('/admin/users-list'),

  // Organizations (admin route — bypasses legacy RBAC)
  getOrganizations: () => api.get<unknown[]>('/admin/organizations-list'),

  // Administrators (admin route)
  getAdministrators: () => api.get<unknown[]>('/admin/administrators-list'),

  addAdministrator: (payload: { email?: string; sub?: string }) =>
    api.post<{ id: string }>('/admin/administrators', payload),

  removeAdministrator: (id: string) =>
    api.delete<void>(`/admin/administrators/${id}`),

  // Health
  getHealth: () => api.get<{ status: string }>('/health'),

  // Service Health (infrastructure probes)
  getServiceHealth: () => api.get<ServiceHealthResponse>('/admin/service-health'),

  // Org Type Registry
  getOrgTypes: () => api.get<OrgTypesResponse>('/admin/org-types'),

  // --- Fraud Detection ---
  getFraudOverview: () =>
    api.get<{ stats: FraudStats; recentEvents: FraudEvent[] }>('/admin/fraud-detection'),

  getFraudBlocklist: () =>
    api.get<{ blockedIPs: FraudBlocklistIP[]; blockedUsers: FraudBlocklistUser[] }>('/admin/fraud-detection/blocklist'),

  addToBlocklist: (payload: { type: 'ip' | 'user'; value?: string; userId?: string; userEmail?: string; reason?: string }) =>
    api.post<FraudBlocklistIP | FraudBlocklistUser>('/admin/fraud-detection/blocklist', payload),

  removeFromBlocklist: (id: string) =>
    api.delete<void>(`/admin/fraud-detection/blocklist/${id}`),

  getFraudRules: () =>
    api.get<{ data: FraudRule[] }>('/admin/fraud-detection/rules'),

  updateFraudEventStatus: (id: string, status: string) =>
    api.patch<{ success: boolean; status: string }>(`/admin/fraud-detection/events/${id}`, { status }),

  // --- Notifications ---
  getNotificationConfig: () =>
    api.get<NotificationConfig>('/admin/notifications'),

  updateNotificationConfig: (payload: Partial<NotificationConfig>) =>
    api.put<{ success: boolean }>('/admin/notifications', payload),

  sendTestNotification: (channel?: string) =>
    api.post<{ success: boolean; message: string }>('/admin/notifications/test', { channel }),

  // --- Phase B: AI Models ---
  getAIModels: (params?: Record<string, string>) =>
    api.get<{ data: AIModel[]; total: number }>('/admin/ai-models', params),

  getAIModel: (id: string) =>
    api.get<AIModel>(`/admin/ai-models/${id}`),

  createAIModel: (payload: CreateAIModelPayload) =>
    api.post<AIModel>('/admin/ai-models', payload),

  updateAIModel: (id: string, payload: Partial<AIModel>) =>
    api.patch<{ success: boolean }>(`/admin/ai-models/${id}`, payload),

  deleteAIModel: (id: string) =>
    api.delete<void>(`/admin/ai-models/${id}`),

  addAIModelVersion: (modelId: string, payload: { tag: string; config?: Record<string, unknown> }) =>
    api.post<AIModelVersion>(`/admin/ai-models/${modelId}/versions`, payload),

  activateAIModelVersion: (modelId: string, tag: string) =>
    api.post<{ success: boolean; activeVersion: string }>(`/admin/ai-models/${modelId}/activate-version`, { tag }),

  getDockerTags: () =>
    api.get<{ data: Record<string, string[]> }>('/admin/ai-models/docker-tags'),

  // --- Phase B: Workflows ---
  getWorkflows: (params?: Record<string, string>) =>
    api.get<{ data: Workflow[]; total: number }>('/admin/workflows', params),

  getWorkflow: (id: string) =>
    api.get<Workflow & { recentExecutions: WorkflowExecution[] }>(`/admin/workflows/${id}`),

  createWorkflow: (payload: Partial<Workflow>) =>
    api.post<Workflow>('/admin/workflows', payload),

  updateWorkflow: (id: string, payload: Partial<Workflow>) =>
    api.patch<{ success: boolean }>(`/admin/workflows/${id}`, payload),

  deleteWorkflow: (id: string) =>
    api.delete<void>(`/admin/workflows/${id}`),

  executeWorkflow: (id: string, input?: Record<string, unknown>) =>
    api.post<WorkflowExecution>(`/admin/workflows/${id}/execute`, { input }),

  getWorkflowExecutions: (workflowId: string, params?: Record<string, string>) =>
    api.get<PaginatedResponse<WorkflowExecution>>(`/admin/workflows/${workflowId}/executions`, params),

  // --- Phase B: Jobs ---
  getJobs: (params?: Record<string, string>) =>
    api.get<{ data: Job[]; total: number; activeCount: number }>('/admin/jobs', params),

  getJobStats: () =>
    api.get<JobStats>('/admin/jobs/stats'),

  getJobDetail: (projectId: string, jobType: string) =>
    api.get<{ projectId: string; projectName: string; jobType: string; events: unknown[] }>(`/admin/jobs/${projectId}/${jobType}`),

  // --- Phase B: Workers ---
  getWorkerStatus: () =>
    api.get<WorkerStatus>('/admin/workers'),

  updateWorkerConfig: (payload: { mode: 'celery' | 'pika' | 'hybrid'; queueOverrides?: Record<string, 'celery' | 'pika'> }) =>
    api.patch<{ success: boolean }>('/admin/workers/config', payload),

  // --- Phase B: Feature Flags ---
  getFeatureFlags: (params?: Record<string, string>) =>
    api.get<{ data: FeatureFlag[]; total: number }>('/admin/feature-flags', params),

  getFeatureFlag: (id: string) =>
    api.get<FeatureFlag>(`/admin/feature-flags/${id}`),

  createFeatureFlag: (payload: CreateFeatureFlagPayload) =>
    api.post<FeatureFlag>('/admin/feature-flags', payload),

  updateFeatureFlag: (id: string, payload: Partial<FeatureFlag>) =>
    api.patch<{ success: boolean }>(`/admin/feature-flags/${id}`, payload),

  toggleFeatureFlag: (id: string) =>
    api.post<{ enabled: boolean }>(`/admin/feature-flags/${id}/toggle`),

  deleteFeatureFlag: (id: string) =>
    api.delete<void>(`/admin/feature-flags/${id}`),

  evaluateFeatureFlags: (params?: Record<string, string>) =>
    api.get<Record<string, boolean>>('/admin/feature-flags/evaluate', params),

  // --- Phase C: Tenants ---
  getTenants: (params?: Record<string, string>) =>
    api.get<{ data: any[]; total: number }>('/admin/tenants', params),

  getTenant: (id: string) =>
    api.get<any>(`/admin/tenants/${id}`),

  createTenant: (payload: { name: string; plan?: string; contactEmail?: string; notes?: string }) =>
    api.post<any>('/admin/tenants', payload),

  updateTenant: (id: string, payload: Record<string, unknown>) =>
    api.patch<{ success: boolean }>(`/admin/tenants/${id}`, payload),

  deleteTenant: (id: string) =>
    api.delete<void>(`/admin/tenants/${id}`),

  // Tenant members
  addTenantMember: (tenantId: string, payload: { email?: string; sub?: string; role?: string }) =>
    api.post<{ id: string }>(`/admin/tenants/${tenantId}/members`, payload),

  removeTenantMember: (tenantId: string, memberId: string) =>
    api.delete<void>(`/admin/tenants/${tenantId}/members/${memberId}`),

  updateTenantMember: (tenantId: string, memberId: string, payload: { role: string }) =>
    api.patch<{ success: boolean }>(`/admin/tenants/${tenantId}/members/${memberId}`, payload),

  resetMemberPassword: (tenantId: string, memberId: string, body: { mode: 'direct' | 'email'; password?: string }) =>
    api.post<{ success: boolean; temporary?: boolean; tempPassword?: string; emailSent?: boolean }>(
      `/admin/tenants/${tenantId}/members/${memberId}/reset-password`, body),

  // Tenant onboarding
  onboardTenant: (payload: { name: string; plan: string; orgType?: string; adminEmail: string; contactEmail?: string; slug?: string; notes?: string }) =>
    api.post<OnboardedTenant>('/admin/tenants/onboard', payload),

  // Tenant feature flags
  getTenantFeatureFlags: (tenantId: string) =>
    api.get<Record<string, boolean>>(`/admin/tenants/${tenantId}/feature-flags`),

  updateTenantFeatureFlag: (tenantId: string, flagKey: string, enabled: boolean) =>
    api.patch<Record<string, boolean>>(`/admin/tenants/${tenantId}/feature-flags/${flagKey}`, { enabled }),

  getTenantAuditLog: (tenantId: string, params?: Record<string, string>) =>
    api.get<PaginatedResponse<AuditLogEntry>>(`/admin/tenants/${tenantId}/audit-log`, params),

  getTenantUsage: (tenantId: string) =>
    api.get<{ projectCount: number; memberCount: number; storageBytes: number }>(`/admin/tenants/${tenantId}/usage`),

  // Tenant org roles
  getOrgRoles: (orgId: string) =>
    api.get<{ data: OrgRole[]; permissions: string[] }>(`/admin/tenants/${orgId}/roles`),

  createOrgRole: (orgId: string, payload: { key: string; label: string; description?: string; permissions?: string[] }) =>
    api.post<OrgRole>(`/admin/tenants/${orgId}/roles`, payload),

  updateOrgRole: (orgId: string, roleId: string, payload: { label?: string; description?: string; permissions?: string[] }) =>
    api.patch<{ success: boolean }>(`/admin/tenants/${orgId}/roles/${roleId}`, payload),

  deleteOrgRole: (orgId: string, roleId: string) =>
    api.delete<void>(`/admin/tenants/${orgId}/roles/${roleId}`),

  // Tenant courses (academic orgs)
  getCourses: (orgId: string) =>
    api.get<{ data: TenantCourse[] }>(`/admin/tenants/${orgId}/courses`),

  createCourse: (orgId: string, payload: { name: string; description?: string }) =>
    api.post<TenantCourse>(`/admin/tenants/${orgId}/courses`, payload),

  deleteCourse: (orgId: string, courseId: string) =>
    api.delete<void>(`/admin/tenants/${orgId}/courses/${courseId}`),

  getCourseMembers: (orgId: string, courseId: string) =>
    api.get<{ data: CourseMember[] }>(`/admin/tenants/${orgId}/courses/${courseId}/members`),

  addCourseMember: (orgId: string, courseId: string, payload: { sub: string; role?: string }) =>
    api.post<{ success: boolean }>(`/admin/tenants/${orgId}/courses/${courseId}/members`, payload),

  removeCourseMember: (orgId: string, courseId: string, sub: string) =>
    api.delete<void>(`/admin/tenants/${orgId}/courses/${courseId}/members/${sub}`),

  // Manufacturer order routing (cross-tenant)
  routeOrderToManufacturerOrg: (orderId: string, payload: { manufacturerOrgId: string; projectIds?: string[]; notes?: string }) =>
    api.post<{ success: boolean; manufacturerOrgId: string; manufacturerOrgName: string }>(`/admin/orders/${orderId}/route-to-manufacturer-org`, payload),

  getManufacturerInbox: (orgId: string, params?: Record<string, string>) =>
    api.get<{ data: Order[]; total: number; page: number; limit: number }>(`/admin/orders/manufacturer-inbox/${orgId}`, params),

  // --- Phase C: CMS Pages ---
  getCMSPages: (params?: Record<string, string>) =>
    api.get<{ data: any[]; total: number }>('/admin/cms-pages', params),

  getCMSPage: (id: string) =>
    api.get<any>(`/admin/cms-pages/${id}`),

  createCMSPage: (payload: Record<string, unknown>) =>
    api.post<any>('/admin/cms-pages', payload),

  updateCMSPage: (id: string, payload: Record<string, unknown>) =>
    api.patch<{ success: boolean }>(`/admin/cms-pages/${id}`, payload),

  deleteCMSPage: (id: string) =>
    api.delete<void>(`/admin/cms-pages/${id}`),

  // --- Phase C: Auth Settings ---
  getAuthSettings: () =>
    api.get<any>('/admin/auth-settings'),

  updateAuthSettings: (payload: Record<string, unknown>) =>
    api.put<{ success: boolean }>('/admin/auth-settings', payload),

  getOTPSettings: () =>
    api.get<any>('/admin/auth-settings/otp'),

  updateOTPSettings: (payload: Record<string, unknown>) =>
    api.put<{ success: boolean }>('/admin/auth-settings/otp', payload),

  getOTPHistory: (params?: Record<string, string>) =>
    api.get<{ data: any[]; total: number; page: number; limit: number }>('/admin/auth-settings/otp/history', params),

  resendOTP: (payload: { email: string }) =>
    api.post<{ success: boolean; message: string }>('/admin/auth-settings/otp/resend', payload),

  bypassOTP: (payload: { email: string }) =>
    api.post<{ success: boolean; message: string }>('/admin/auth-settings/otp/bypass', payload),

  resetAdminPassword: (payload: { email: string; password?: string }) =>
    api.post<{ success: boolean; temporary: boolean }>('/admin/auth-settings/reset-admin-password', payload),

  // --- Phase C: Drydock ---
  getDrydockStatus: () =>
    api.get<{ status: string; baseUrl: string; health: any; endpointCount: number; categories: any[] }>('/admin/drydock'),

  getDrydockHealth: () =>
    api.get<any>('/admin/drydock/health'),

  getDrydockEndpoints: () =>
    api.get<{ data: any[]; total: number }>('/admin/drydock/endpoints'),

  getDrydockUpdateStatus: () =>
    api.get<{ initialized: boolean; commit?: string; message?: string; date?: string; remote?: string }>('/admin/drydock/update/status'),

  updateDrydock: () =>
    api.post<{ success: boolean; output: string; commit?: string; message?: string; rebuildCommand: string }>('/admin/drydock/update'),

  // --- Phase C: Rate Limits ---
  getRateLimits: () =>
    api.get<{ data: any[]; total: number }>('/admin/rate-limits'),

  createRateLimit: (payload: Record<string, unknown>) =>
    api.post<any>('/admin/rate-limits', payload),

  updateRateLimit: (id: string, payload: Record<string, unknown>) =>
    api.patch<{ success: boolean }>(`/admin/rate-limits/${id}`, payload),

  deleteRateLimit: (id: string) =>
    api.delete<void>(`/admin/rate-limits/${id}`),

  // --- Phase C: Content Policies ---
  getContentPolicies: () =>
    api.get<{ data: any[]; total: number }>('/admin/content-policies'),

  createContentPolicy: (payload: Record<string, unknown>) =>
    api.post<any>('/admin/content-policies', payload),

  updateContentPolicy: (id: string, payload: Record<string, unknown>) =>
    api.patch<{ success: boolean }>(`/admin/content-policies/${id}`, payload),

  deleteContentPolicy: (id: string) =>
    api.delete<void>(`/admin/content-policies/${id}`),

  // --- Phase C: Messaging ---
  getMessagingConfig: () =>
    api.get<any>('/admin/messaging'),

  updateMessagingConfig: (payload: Record<string, unknown>) =>
    api.put<{ success: boolean }>('/admin/messaging', payload),

  sendTestEmail: (to: string) =>
    api.post<{ success: boolean; message: string }>('/admin/messaging/test-email', { to }),

  getEmailLog: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<EmailLogEntry>>('/admin/messaging/email-log', params),

  getEmailLogStats: () =>
    api.get<EmailLogStats>('/admin/messaging/email-log/stats'),

  // --- Phase C: Analytics ---
  getAnalyticsConfig: () =>
    api.get<any>('/admin/analytics'),

  updateAnalyticsConfig: (payload: Record<string, unknown>) =>
    api.put<{ success: boolean }>('/admin/analytics', payload),

  getAnalyticsStats: () =>
    api.get<{ userCount: number; tenantCount: number; projectCount: number; loginsByDay: Record<string, number>; revenueByDay: Record<string, { revenue: number; orders: number }>; jobVolumeByDay: Record<string, number> }>('/admin/analytics/stats'),

  getTenantAnalyticsConfig: (tenantId: string) =>
    api.get<any>(`/admin/analytics/tenant/${tenantId}`),

  updateTenantAnalyticsConfig: (tenantId: string, payload: Record<string, unknown>) =>
    api.put<{ success: boolean }>(`/admin/analytics/tenant/${tenantId}`, payload),

  getUtmStats: () =>
    api.get<{ topSources: { source: string; count: number }[]; topCampaigns: { campaign: string; count: number }[]; totalEvents: number; totalConversions: number; totalConversionValue: number }>('/admin/analytics/utm-stats'),

  getUtmEvents: (params?: Record<string, string>) =>
    api.get<{ data: any[]; total: number; page: number; limit: number }>('/admin/analytics/utm-events', params),

  // --- Phase D: Pricing ---
  getPricingPlans: (params?: Record<string, string>) =>
    api.get<{ data: PricingPlan[]; total: number }>('/admin/pricing', params),

  getPricingPlan: (id: string) =>
    api.get<PricingPlan>(`/admin/pricing/${id}`),

  createPricingPlan: (payload: Partial<PricingPlan>) =>
    api.post<PricingPlan>('/admin/pricing', payload),

  updatePricingPlan: (id: string, payload: Partial<PricingPlan>) =>
    api.patch<{ success: boolean }>(`/admin/pricing/${id}`, payload),

  deletePricingPlan: (id: string) =>
    api.delete<void>(`/admin/pricing/${id}`),

  duplicatePricingPlan: (id: string) =>
    api.post<PricingPlan>(`/admin/pricing/${id}/duplicate`),

  // --- Phase D: Payment Gateways ---
  getPaymentGateways: () =>
    api.get<{ data: PaymentGateway[]; total: number }>('/admin/payment-gateways'),

  getPaymentGateway: (id: string) =>
    api.get<PaymentGateway>(`/admin/payment-gateways/${id}`),

  createPaymentGateway: (payload: Partial<PaymentGateway>) =>
    api.post<PaymentGateway>('/admin/payment-gateways', payload),

  updatePaymentGateway: (id: string, payload: Partial<PaymentGateway>) =>
    api.patch<{ success: boolean }>(`/admin/payment-gateways/${id}`, payload),

  deletePaymentGateway: (id: string) =>
    api.delete<void>(`/admin/payment-gateways/${id}`),

  testPaymentGateway: (id: string) =>
    api.post<{ success: boolean; message: string; testedAt: string }>(`/admin/payment-gateways/${id}/test`),

  togglePaymentGateway: (id: string) =>
    api.post<{ isEnabled: boolean }>(`/admin/payment-gateways/${id}/toggle`),

  // --- Phase D: Shop ---
  getShopSettings: () =>
    api.get<ShopSettings>('/admin/shop'),

  updateShopSettings: (payload: Partial<ShopSettings>) =>
    api.put<{ success: boolean }>('/admin/shop', payload),

  getProducts: (params?: Record<string, string>) =>
    api.get<{ data: Product[]; total: number }>('/admin/shop/products', params),

  getProduct: (id: string) =>
    api.get<Product>(`/admin/shop/products/${id}`),

  createProduct: (payload: Partial<Product>) =>
    api.post<Product>('/admin/shop/products', payload),

  updateProduct: (id: string, payload: Partial<Product>) =>
    api.patch<{ success: boolean }>(`/admin/shop/products/${id}`, payload),

  deleteProduct: (id: string) =>
    api.delete<void>(`/admin/shop/products/${id}`),

  // Product Images
  uploadProductImage: (productId: string, formData: FormData) =>
    api.upload<ProductImage>(`/admin/shop/products/${productId}/images`, formData),

  getProductImageUrl: (productId: string, imageId: string) =>
    `/api/admin/shop/products/${productId}/images/${imageId}`,

  deleteProductImage: (productId: string, imageId: string) =>
    api.delete<void>(`/admin/shop/products/${productId}/images/${imageId}`),

  updateProductImage: (productId: string, imageId: string, payload: { altText?: string; isPrimary?: boolean }) =>
    api.patch<{ success: boolean }>(`/admin/shop/products/${productId}/images/${imageId}`, payload),

  reorderProductImages: (productId: string, order: string[]) =>
    api.patch<{ success: boolean }>(`/admin/shop/products/${productId}/images/reorder`, { order }),

  // AI Assist
  aiAssistProduct: (payload: AiAssistRequest) =>
    api.post<AiAssistResponse>('/admin/shop/products/ai-assist', payload),

  // Upsell Groups
  getUpsellGroups: () =>
    api.get<Record<string, UpsellGroup>>('/admin/shop/upsell-groups'),

  saveUpsellGroups: (groups: Record<string, UpsellGroup>) =>
    api.put<{ success: boolean }>('/admin/shop/upsell-groups', { groups }),

  suggestUpsells: (productId: string) =>
    api.get<UpsellSuggestion>(`/admin/shop/products/${productId}/suggest-upsells`),

  // --- Phase D: Shipping ---
  getShippingSettings: () =>
    api.get<ShippingSettings>('/admin/shipping'),

  updateShippingSettings: (payload: Partial<ShippingSettings>) =>
    api.put<{ success: boolean }>('/admin/shipping', payload),

  updateShippingOrigin: (origin: ShippingSettings['origin']) =>
    api.patch<{ success: boolean }>('/admin/shipping/origin', origin),

  addShippingCarrier: (payload: { name: string; isEnabled?: boolean; accountNumber?: string }) =>
    api.post<any>('/admin/shipping/carriers', payload),

  updateShippingCarrier: (id: string, payload: Record<string, unknown>) =>
    api.patch<{ success: boolean }>(`/admin/shipping/carriers/${id}`, payload),

  deleteShippingCarrier: (id: string) =>
    api.delete<void>(`/admin/shipping/carriers/${id}`),

  addShippingZone: (payload: { name: string; countries?: string[] }) =>
    api.post<any>('/admin/shipping/zones', payload),

  deleteShippingZone: (id: string) =>
    api.delete<void>(`/admin/shipping/zones/${id}`),

  addShippingRate: (payload: { zoneId: string; carrierId: string; method?: string; flatRate?: number; freeAbove?: number; estimatedDays?: number }) =>
    api.post<any>('/admin/shipping/rates', payload),

  deleteShippingRate: (id: string) =>
    api.delete<void>(`/admin/shipping/rates/${id}`),

  // --- Phase D: Orders ---
  getOrders: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Order>>('/admin/orders', params),

  getOrderStats: () =>
    api.get<OrderStats>('/admin/orders/stats'),

  getOrder: (id: string) =>
    api.get<Order>(`/admin/orders/${id}`),

  createOrder: (payload: Partial<Order>) =>
    api.post<Order>('/admin/orders', payload),

  updateOrder: (id: string, payload: Partial<Order>) =>
    api.patch<{ success: boolean }>(`/admin/orders/${id}`, payload),

  updateOrderStatus: (id: string, status: string) =>
    api.patch<{ success: boolean; status: string }>(`/admin/orders/${id}/status`, { status }),

  fulfillOrder: (id: string, payload: { trackingNumber?: string; carrier?: string }) =>
    api.post<{ success: boolean; status: string }>(`/admin/orders/${id}/fulfill`, payload),

  refundOrder: (id: string, payload: { amount?: number; reason?: string }) =>
    api.post<{ success: boolean; refundAmount: number }>(`/admin/orders/${id}/refund`, payload),

  deleteOrder: (id: string) =>
    api.delete<void>(`/admin/orders/${id}`),

  // --- Phase D: Manufacturing ---
  getManufacturers: (params?: Record<string, string>) =>
    api.get<{ data: Manufacturer[]; total: number }>('/admin/manufacturing', params),

  getManufacturer: (id: string) =>
    api.get<Manufacturer>(`/admin/manufacturing/${id}`),

  createManufacturer: (payload: Partial<Manufacturer>) =>
    api.post<Manufacturer>('/admin/manufacturing', payload),

  updateManufacturer: (id: string, payload: Partial<Manufacturer>) =>
    api.patch<{ success: boolean }>(`/admin/manufacturing/${id}`, payload),

  deleteManufacturer: (id: string) =>
    api.delete<void>(`/admin/manufacturing/${id}`),

  getManufacturerOrders: (id: string) =>
    api.get<{ data: Order[]; total: number }>(`/admin/manufacturing/${id}/orders`),

  getManufacturingQueue: () =>
    api.get<{ data: ManufacturingQueueGroup[] }>('/admin/manufacturing/queue'),

  // --- Phase D: Customers ---
  getCustomers: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Customer>>('/admin/customers', params),

  getCustomerStats: () =>
    api.get<CustomerStats>('/admin/customers/stats'),

  getCustomer: (id: string) =>
    api.get<Customer>(`/admin/customers/${id}`),

  updateCustomer: (id: string, payload: Partial<Customer>) =>
    api.patch<{ success: boolean }>(`/admin/customers/${id}`, payload),

  addCustomerNote: (id: string, text: string) =>
    api.post<{ id: string; text: string; createdAt: string }>(`/admin/customers/${id}/notes`, { text }),

  getCustomerOrders: (id: string) =>
    api.get<{ data: Order[]; total: number }>(`/admin/customers/${id}/orders`),

  getCustomerActivity: (id: string) =>
    api.get<{ data: any[] }>(`/admin/customers/${id}/activity`),

  getCustomerCohorts: () =>
    api.get<{ data: CohortData[] }>('/admin/customers/cohorts'),

  // --- Phase D: Support ---
  getSupportTickets: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<SupportTicket>>('/admin/support', params),

  getSupportStats: () =>
    api.get<SupportStats>('/admin/support/stats'),

  getSupportConfig: () =>
    api.get<SupportConfig>('/admin/support/config'),

  updateSupportConfig: (payload: Partial<SupportConfig>) =>
    api.put<{ success: boolean }>('/admin/support/config', payload),

  getSupportTicket: (id: string) =>
    api.get<SupportTicket>(`/admin/support/${id}`),

  createSupportTicket: (payload: Partial<SupportTicket>) =>
    api.post<SupportTicket>('/admin/support', payload),

  updateSupportTicket: (id: string, payload: Partial<SupportTicket>) =>
    api.patch<{ success: boolean }>(`/admin/support/${id}`, payload),

  replySupportTicket: (id: string, body: string, messageType?: string) =>
    api.post<SupportMessage>(`/admin/support/${id}/reply`, { body, messageType }),

  assignSupportTicket: (id: string, assignedTo?: string) =>
    api.post<{ success: boolean }>(`/admin/support/${id}/assign`, { assignedTo }),

  escalateSupportTicket: (id: string) =>
    api.post<{ success: boolean; priority: string }>(`/admin/support/${id}/escalate`),

  deleteSupportTicket: (id: string) =>
    api.delete<void>(`/admin/support/${id}`),

  createSupportTicketWithAttachments: (formData: FormData) =>
    api.upload<SupportTicket>('/admin/support/create-with-attachments', formData),

  replySupportTicketWithAttachments: (id: string, formData: FormData) =>
    api.upload<SupportMessage>(`/admin/support/${id}/reply-with-attachments`, formData),

  getSupportAttachmentUrl: (ticketId: string, fileId: string) =>
    `/admin/support/${ticketId}/attachments/${fileId}`,

  fetchSupportAttachmentBlob: (ticketId: string, fileId: string) =>
    api.blob(`/admin/support/${ticketId}/attachments/${fileId}`),

  deleteSupportAttachment: (ticketId: string, fileId: string) =>
    api.delete<{ success: boolean }>(`/admin/support/${ticketId}/attachments/${fileId}`),

  aiOverwatchTicket: (id: string) =>
    api.post<{ subject: string; body: string }>(`/admin/support/${id}/ai-overwatch`),

  generateRepairPlan: (id: string) =>
    api.post<SupportMessage & { planId?: string }>(`/admin/support/${id}/repair-plan`),

  // --- Repair Plans ---
  getRepairPlanStats: () =>
    api.get<{ total: number; draft: number; approved: number; rejected: number; superseded: number; totalTokens: number }>('/admin/repair-plans/stats'),

  getRepairPlans: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<RepairPlan>>('/admin/repair-plans', params),

  getRepairPlan: (id: string) =>
    api.get<RepairPlan>(`/admin/repair-plans/${id}`),

  updateRepairPlan: (id: string, payload: Partial<RepairPlan>) =>
    api.patch<{ success: boolean }>(`/admin/repair-plans/${id}`, payload),

  deleteRepairPlan: (id: string) =>
    api.delete<{ success: boolean }>(`/admin/repair-plans/${id}`),

  regenerateRepairPlan: (id: string, correctionInstructions: string) =>
    api.post<RepairPlan>(`/admin/repair-plans/${id}/regenerate`, { correctionInstructions }),

  uploadRepairPlanImage: (formData: FormData) =>
    api.upload<{ url: string }>('/admin/repair-plans/upload-image', formData),

  uploadMarkdownImage: (formData: FormData) =>
    api.upload<{ url: string }>('/admin/markdown-images/upload', formData),

  // --- Phase E: Knowledge Base ---
  getArticles: (params?: Record<string, string>) =>
    api.get<{ data: KnowledgeBaseArticle[]; total: number }>('/admin/knowledge-base', params),

  getArticleStats: () =>
    api.get<{ total: number; published: number; draft: number; archived: number; totalViews: number; byCategory: Record<string, number> }>('/admin/knowledge-base/stats'),

  getArticleCategories: () =>
    api.get<{ data: string[] }>('/admin/knowledge-base/categories'),

  getArticle: (id: string) =>
    api.get<KnowledgeBaseArticle>(`/admin/knowledge-base/${id}`),

  createArticle: (payload: Partial<KnowledgeBaseArticle>) =>
    api.post<KnowledgeBaseArticle>('/admin/knowledge-base', payload),

  updateArticle: (id: string, payload: Partial<KnowledgeBaseArticle>) =>
    api.patch<{ success: boolean }>(`/admin/knowledge-base/${id}`, payload),

  deleteArticle: (id: string) =>
    api.delete<void>(`/admin/knowledge-base/${id}`),

  // --- Phase E: Custom Agents ---
  getCustomAgents: (params?: Record<string, string>) =>
    api.get<{ data: CustomAgent[]; total: number }>('/admin/custom-agents', params),

  getCustomAgent: (id: string) =>
    api.get<CustomAgent>(`/admin/custom-agents/${id}`),

  createCustomAgent: (payload: Partial<CustomAgent>) =>
    api.post<CustomAgent>('/admin/custom-agents', payload),

  updateCustomAgent: (id: string, payload: Partial<CustomAgent>) =>
    api.patch<{ success: boolean }>(`/admin/custom-agents/${id}`, payload),

  deleteCustomAgent: (id: string) =>
    api.delete<void>(`/admin/custom-agents/${id}`),

  testCustomAgent: (id: string, input?: string) =>
    api.post<AgentTestResult>(`/admin/custom-agents/${id}/test`, { input }),

  duplicateCustomAgent: (id: string) =>
    api.post<CustomAgent>(`/admin/custom-agents/${id}/duplicate`),

  assistPrompt: (payload: { systemPrompt: string; agentName?: string; description?: string; providerId?: string }) =>
    api.post<{ improvedPrompt: string; tokensUsed: number }>('/admin/custom-agents/assist-prompt', payload),

  // --- Chat Management ---
  getChatConversations: (params?: Record<string, string>) =>
    api.get<{ data: ChatConversation[]; total: number; page: number; limit: number }>('/admin/chat', params),

  getChatConversation: (id: string) =>
    api.get<ChatConversation>(`/admin/chat/${id}`),

  replyChatConversation: (id: string, body: string) =>
    api.post<{ success: boolean; message: any }>(`/admin/chat/${id}/reply`, { body }),

  takeOverChat: (id: string) =>
    api.post<{ success: boolean }>(`/admin/chat/${id}/take-over`),

  closeChat: (id: string) =>
    api.post<{ success: boolean }>(`/admin/chat/${id}/close`),

  getChatStats: () =>
    api.get<ChatStats>('/admin/chat/stats'),

  getChatContexts: () =>
    api.get<{ data: { id: string; context: string; name: string; isActive: boolean }[] }>('/admin/chat/contexts'),

  // --- Phase E: Marketplace ---
  getMarketplaceProviders: (params?: Record<string, string>) =>
    api.get<{ data: MarketplaceProvider[]; total: number }>('/admin/marketplace', params),

  getMarketplaceStats: () =>
    api.get<MarketplaceStats>('/admin/marketplace/stats'),

  getMarketplaceProvider: (id: string) =>
    api.get<MarketplaceProvider>(`/admin/marketplace/${id}`),

  createMarketplaceProvider: (payload: Partial<MarketplaceProvider>) =>
    api.post<MarketplaceProvider>('/admin/marketplace', payload),

  updateMarketplaceProvider: (id: string, payload: Partial<MarketplaceProvider>) =>
    api.patch<{ success: boolean }>(`/admin/marketplace/${id}`, payload),

  deleteMarketplaceProvider: (id: string) =>
    api.delete<void>(`/admin/marketplace/${id}`),

  setMarketplaceApiKey: (id: string, apiKey: string) =>
    api.put<{ success: boolean; apiKeyMasked: string }>(`/admin/marketplace/${id}/api-key`, { apiKey }),

  removeMarketplaceApiKey: (id: string) =>
    api.delete<void>(`/admin/marketplace/${id}/api-key`),

  toggleMarketplaceProvider: (id: string) =>
    api.post<{ isEnabled: boolean }>(`/admin/marketplace/${id}/toggle`),

  getMarketplaceUsage: (id: string, params?: Record<string, string>) =>
    api.get<PaginatedResponse<MarketplaceUsage>>(`/admin/marketplace/${id}/usage`, params),

  installMarketplaceProvider: (id: string) =>
    api.post<{ success: boolean }>(`/admin/marketplace/${id}/install`),

  // --- Phase E: AI Settings ---
  getAISettings: () =>
    api.get<AISettings>('/admin/ai-settings'),

  updateAISettings: (payload: Partial<AISettings>) =>
    api.put<{ success: boolean }>('/admin/ai-settings', payload),

  setAIApiKey: (apiKey: string) =>
    api.put<{ success: boolean; apiKeyMasked: string }>('/admin/ai-settings/api-key', { apiKey }),

  removeAIApiKey: () =>
    api.delete<void>('/admin/ai-settings/api-key'),

  getAIUsageSummary: () =>
    api.get<AIUsageSummary>('/admin/ai-settings/usage-summary'),

  // --- AI Providers ---
  getAIProviders: (params?: Record<string, string>) =>
    api.get<{ data: AIProvider[]; total: number }>('/admin/ai-providers', params),

  getAIProvider: (id: string) =>
    api.get<AIProvider>(`/admin/ai-providers/${id}`),

  getAIProviderNames: () =>
    api.get<AIProviderName[]>('/admin/ai-providers/names'),

  createAIProvider: (payload: Partial<AIProvider>) =>
    api.post<AIProvider>('/admin/ai-providers', payload),

  updateAIProvider: (id: string, payload: Partial<AIProvider>) =>
    api.patch<{ success: boolean }>(`/admin/ai-providers/${id}`, payload),

  deleteAIProvider: (id: string) =>
    api.delete<void>(`/admin/ai-providers/${id}`),

  setAIProviderApiKey: (id: string, apiKey: string) =>
    api.put<{ success: boolean; apiKeyMasked: string }>(`/admin/ai-providers/${id}/api-key`, { apiKey }),

  removeAIProviderApiKey: (id: string) =>
    api.delete<void>(`/admin/ai-providers/${id}/api-key`),

  testAIProvider: (id: string) =>
    api.post<AIProviderTestResult>(`/admin/ai-providers/${id}/test`),

  // --- Agent Skills ---
  getAgentSkills: (params?: Record<string, string>) =>
    api.get<{ data: AgentSkill[]; total: number }>('/admin/agent-skills', params),

  getAgentSkill: (id: string) =>
    api.get<AgentSkill>(`/admin/agent-skills/${id}`),

  uploadAgentSkill: (formData: FormData) =>
    api.upload<AgentSkill>('/admin/agent-skills/upload', formData),

  updateAgentSkill: (id: string, payload: Partial<AgentSkill>) =>
    api.patch<{ success: boolean }>(`/admin/agent-skills/${id}`, payload),

  deleteAgentSkill: (id: string) =>
    api.delete<void>(`/admin/agent-skills/${id}`),

  // --- Custom Agent Bindings ---
  getBindingOptions: () =>
    api.get<Record<string, string[]>>('/admin/custom-agents/binding-options'),

  getKBSources: () =>
    api.get<{ kbCategories: string[]; wikiSections: string[] }>('/admin/custom-agents/kb-sources'),

  getAgentsByBinding: (type: string, value: string) =>
    api.get<{ data: CustomAgent[]; total: number }>(`/admin/custom-agents/by-binding/${type}/${value}`),

  // --- Phase F: Network Settings ---
  getNetworkSettings: () =>
    api.get<NetworkSettings>('/admin/network'),

  updateNetworkSettings: (payload: Partial<NetworkSettings>) =>
    api.put<{ success: boolean }>('/admin/network', payload),

  addTunnel: (payload: { name: string; type: string; host?: string; port?: number }) =>
    api.post<NetworkTunnel>('/admin/network/tunnels', payload),

  deleteTunnel: (tunnelId: string) =>
    api.delete<void>(`/admin/network/tunnels/${tunnelId}`),

  toggleTunnel: (tunnelId: string) =>
    api.post<{ isActive: boolean }>(`/admin/network/tunnels/${tunnelId}/toggle`),

  getNetworkDiagnostics: () =>
    api.get<NetworkDiagnostics>('/admin/network/diagnostics'),

  // --- Phase F: Version Control ---
  getVersionInfo: () =>
    api.get<VersionInfo>('/admin/version-control/info'),

  refreshVersionInfo: () =>
    api.post<VersionInfo>('/admin/version-control/refresh'),

  getDeployments: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Deployment>>('/admin/version-control/deployments', params),

  createDeployment: (payload: { version: string; environment: string; commit?: string; branch?: string; notes?: string }) =>
    api.post<Deployment>('/admin/version-control/deployments', payload),

  updateDeployment: (id: string, payload: Partial<Deployment>) =>
    api.patch<{ success: boolean }>(`/admin/version-control/deployments/${id}`, payload),

  rollbackDeployment: (id: string) =>
    api.post<Deployment>(`/admin/version-control/deployments/${id}/rollback`),

  getChangelog: (params?: Record<string, string>) =>
    api.get<{ data: Deployment[]; total: number }>('/admin/version-control/changelog', params),

  // --- Phase F: Dev Wiki ---
  getWikiPages: (params?: Record<string, string>) =>
    api.get<{ data: DevWikiPage[]; total: number }>('/admin/dev-wiki', params),

  getWikiSections: () =>
    api.get<{ data: string[] }>('/admin/dev-wiki/sections'),

  getWikiPage: (id: string) =>
    api.get<DevWikiPage>(`/admin/dev-wiki/${id}`),

  createWikiPage: (payload: Partial<DevWikiPage>) =>
    api.post<DevWikiPage>('/admin/dev-wiki', payload),

  updateWikiPage: (id: string, payload: Partial<DevWikiPage>) =>
    api.patch<{ success: boolean }>(`/admin/dev-wiki/${id}`, payload),

  deleteWikiPage: (id: string) =>
    api.delete<void>(`/admin/dev-wiki/${id}`),

  // --- Prompt Templates ---
  getPromptTemplates: (params?: Record<string, string>) =>
    api.get<{ data: PromptTemplate[]; total: number }>('/admin/prompt-templates', params),

  getPromptTemplate: (id: string) =>
    api.get<PromptTemplate>(`/admin/prompt-templates/${id}`),

  createPromptTemplate: (payload: Partial<PromptTemplate>) =>
    api.post<PromptTemplate>('/admin/prompt-templates', payload),

  updatePromptTemplate: (id: string, payload: Partial<PromptTemplate>) =>
    api.patch<{ success: boolean }>(`/admin/prompt-templates/${id}`, payload),

  deletePromptTemplate: (id: string) =>
    api.delete<void>(`/admin/prompt-templates/${id}`),

  executePromptTemplate: (id: string, payload: { variables?: Record<string, string>; providerId?: string }) =>
    api.post<{ result: string; tokensUsed: number; model: string }>(`/admin/prompt-templates/${id}/execute`, payload),

  // --- Phase F: Database Management ---
  getDatabaseStats: () =>
    api.get<DatabaseStats>('/admin/database/stats'),

  getCollections: () =>
    api.get<{ data: CollectionInfo[]; total: number }>('/admin/database/collections'),

  getCollectionStats: (name: string) =>
    api.get<CollectionInfo>(`/admin/database/collections/${name}/stats`),

  compactCollection: (name: string) =>
    api.post<{ success: boolean; message: string }>(`/admin/database/collections/${name}/compact`),

  getBackups: () =>
    api.get<{ data: DbBackup[]; total: number }>('/admin/database/backups'),

  createBackup: (payload?: { name?: string; notes?: string; type?: 'full' | 'mongo-only' | 'pg-only' }) =>
    api.post<DbBackup>('/admin/database/backups', payload || {}),

  deleteBackup: (id: string) =>
    api.delete<void>(`/admin/database/backups/${id}`),

  getBackupSchedule: () =>
    api.get<BackupSchedule>('/admin/database/backups/schedule'),

  updateBackupSchedule: (payload: Partial<BackupSchedule>) =>
    api.post<{ success: boolean; schedule: BackupSchedule }>('/admin/database/backups/schedule', payload),

  restoreBackup: (id: string, confirmation: string) =>
    api.post<{ message: string }>(`/admin/database/backups/${id}/restore`, { confirmation }),

  downloadBackup: (id: string) =>
    api.blob(`/admin/database/backups/${id}/download`),

  // --- Phase F: Access Control ---
  getRoles: () =>
    api.get<{ data: Role[]; total: number }>('/admin/access-control/roles'),

  getRole: (id: string) =>
    api.get<Role>(`/admin/access-control/roles/${id}`),

  createRole: (payload: { name: string; description?: string; permissions?: string[] }) =>
    api.post<Role>('/admin/access-control/roles', payload),

  updateRole: (id: string, payload: Partial<Role>) =>
    api.patch<{ success: boolean }>(`/admin/access-control/roles/${id}`, payload),

  deleteRole: (id: string) =>
    api.delete<void>(`/admin/access-control/roles/${id}`),

  getPermissions: () =>
    api.get<{ data: Permission[]; grouped: Record<string, Permission[]>; total: number }>('/admin/access-control/permissions'),

  setRolePermissions: (roleId: string, permissions: string[]) =>
    api.put<{ success: boolean }>(`/admin/access-control/roles/${roleId}/permissions`, { permissions }),

  // --- Phase F: Credentials (Vault) ---
  getCredentials: () =>
    api.get<{ data: Credential[]; total: number }>('/admin/credentials'),

  getCredential: (id: string) =>
    api.get<Credential>(`/admin/credentials/${id}`),

  createCredential: (payload: { name: string; envKey?: string; type: string; service?: string; value?: string; description?: string; expiresAt?: string }) =>
    api.post<Credential>('/admin/credentials', payload),

  updateCredential: (id: string, payload: Partial<Credential>) =>
    api.patch<{ success: boolean }>(`/admin/credentials/${id}`, payload),

  setCredentialValue: (id: string, value: string) =>
    api.put<{ success: boolean; valueMasked: string }>(`/admin/credentials/${id}/value`, { value }),

  revealCredentialValue: (id: string) =>
    api.get<{ value: string }>(`/admin/credentials/${id}/reveal`),

  deleteCredential: (id: string) =>
    api.delete<void>(`/admin/credentials/${id}`),

  rotateCredential: (id: string) =>
    api.post<{ success: boolean; lastRotatedAt: string }>(`/admin/credentials/${id}/rotate`),

  exportCredentialsEnv: () =>
    api.get<{ envContent: string; credentialCount: number }>('/admin/credentials/export-env'),

  // --- Email Templates ---
  getEmailTemplates: (params?: Record<string, string>) =>
    api.get<{ data: EmailTemplate[]; total: number }>('/admin/email-templates', params),

  getEmailTemplate: (id: string) =>
    api.get<EmailTemplate>(`/admin/email-templates/${id}`),

  createEmailTemplate: (payload: Partial<EmailTemplate>) =>
    api.post<EmailTemplate>('/admin/email-templates', payload),

  updateEmailTemplate: (id: string, payload: Partial<EmailTemplate>) =>
    api.patch<{ success: boolean }>(`/admin/email-templates/${id}`, payload),

  deleteEmailTemplate: (id: string) =>
    api.delete<void>(`/admin/email-templates/${id}`),

  previewEmailTemplate: (payload: { htmlBody: string; subject: string; variables: Record<string, string> }) =>
    api.post<{ html: string; subject: string }>('/admin/email-templates/preview', payload),

  sendTestEmailTemplate: (id: string, to: string, variables?: Record<string, string>) =>
    api.post<{ success: boolean; message: string }>(`/admin/email-templates/${id}/send-test`, { to, variables }),

  seedEmailTemplates: () =>
    api.post<{ success: boolean; message: string }>('/admin/email-templates/seed'),

  // --- Admin Credits ---
  getCreditsOverview: () =>
    api.get<AdminCreditOverview>('/admin/credits/overview'),

  getOrgCredits: (orgId: string) =>
    api.get<AdminOrgCredits>(`/admin/credits/${orgId}`),

  adjustOrgCredits: (orgId: string, payload: { amount: number; type: 'grant' | 'deduct'; description?: string }) =>
    api.post<{ success: boolean }>(`/admin/credits/${orgId}/adjust`, payload),

  // --- Login Audit ---
  getLoginAuditLog: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<LoginAuditEntry>>('/admin/login-audit', params),

  getLoginAuditStats: () =>
    api.get<LoginAuditStats>('/admin/login-audit/stats'),

  // --- Profile ---
  getProfile: () =>
    api.get<AdminProfile>('/profile'),

  updateProfile: (data: Partial<AdminProfile>) =>
    api.patch<AdminProfile>('/profile', data),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.upload<{ key: string }>('/profile/avatar', formData)
  },

  getAvatarUrl: (key: string) =>
    `${import.meta.env.VITE_API_URL || '/api'}/profile/avatar/${key}`,

  // --- Change Password ---
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', data),
}
