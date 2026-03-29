import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  real,
  doublePrecision,
  boolean,
  bigint,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const orgPlanEnum = pgEnum('org_plan', [
  'free',
  'pro',
  'team',
  'enterprise',
]);

export const orgMemberRoleEnum = pgEnum('org_member_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);

export const deviceStatusEnum = pgEnum('device_status', [
  'online',
  'offline',
  'pairing',
  'disabled',
]);

export const mediaTypeEnum = pgEnum('media_type', [
  'image',
  'video',
  'audio',
  'document',
]);

export const repeatTypeEnum = pgEnum('repeat_type', [
  'once',
  'daily',
  'weekly',
  'monthly',
  'cron',
]);

export const commandTypeEnum = pgEnum('command_type', [
  'capture_photo',
  'capture_video',
  'record_audio',
  'stream_video',
  'reboot',
  'update_firmware',
  'custom',
]);

export const deviceCommandStatusEnum = pgEnum('device_command_status', [
  'pending',
  'sent',
  'acknowledged',
  'completed',
  'failed',
  'timeout',
]);

// Tables

export const fleets = pgTable('fleets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 500 }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  plan: orgPlanEnum('plan').notNull().default('free'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  subscriptionId: varchar('subscription_id', { length: 255 }),
  subscriptionStatus: varchar('subscription_status', { length: 50 }),
  deviceLimit: integer('device_limit').notNull().default(3),
  storageLimit: bigint('storage_limit', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgMemberRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgUserIdx: uniqueIndex('org_members_org_id_user_id_idx').on(
      t.orgId,
      t.userId
    ),
  })
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fleetId: uuid('fleet_id').references(() => fleets.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    hwModel: varchar('hw_model', { length: 255 }).notNull(),
    serialNumber: varchar('serial_number', { length: 255 }).notNull().unique(),
    pairingCode: varchar('pairing_code', { length: 6 }).notNull().unique(),
    pairingCodeExpiresAt: timestamp('pairing_code_expires_at', {
      withTimezone: true,
    }),
    status: deviceStatusEnum('status').notNull().default('pairing'),
    firmwareVersion: varchar('firmware_version', { length: 50 }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    lastIp: varchar('last_ip', { length: 45 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdIdx: index('devices_org_id_idx').on(t.orgId),
    serialNumberIdx: uniqueIndex('devices_serial_number_idx').on(
      t.serialNumber
    ),
    pairingCodeIdx: uniqueIndex('devices_pairing_code_idx').on(
      t.pairingCode
    ),
  })
);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    deviceIdIdx: index('device_tokens_device_id_idx').on(t.deviceId),
    tokenIdx: uniqueIndex('device_tokens_token_idx').on(t.token),
  })
);

export const telemetryRecords = pgTable(
  'telemetry_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
    batteryLevel: integer('battery_level'),
    signalStrength: integer('signal_strength'),
    cpuTemp: real('cpu_temp'),
    freeMemory: integer('free_memory'),
    uptimeSeconds: integer('uptime_seconds'),
    customData: jsonb('custom_data'),
  },
  (t) => ({
    deviceIdTimestampIdx: index('telemetry_records_device_id_timestamp_idx').on(
      t.deviceId,
      t.timestamp
    ),
    deviceIdIdx: index('telemetry_records_device_id_idx').on(t.deviceId),
  })
);

export const gpsRecords = pgTable(
  'gps_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    altitude: real('altitude'),
    speed: real('speed'),
    heading: real('heading'),
    accuracy: real('accuracy'),
    satellites: integer('satellites'),
  },
  (t) => ({
    deviceIdTimestampIdx: index('gps_records_device_id_timestamp_idx').on(
      t.deviceId,
      t.timestamp
    ),
    deviceIdIdx: index('gps_records_device_id_idx').on(t.deviceId),
  })
);

export const mediaFiles = pgTable(
  'media_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    type: mediaTypeEnum('type').notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    s3Key: varchar('s3_key', { length: 500 }).notNull(),
    s3Bucket: varchar('s3_bucket', { length: 255 }).notNull(),
    thumbnailS3Key: varchar('thumbnail_s3_key', { length: 500 }),
    duration: integer('duration'),
    width: integer('width'),
    height: integer('height'),
    metadata: jsonb('metadata'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdIdx: index('media_files_org_id_idx').on(t.orgId),
    deviceIdIdx: index('media_files_device_id_idx').on(t.deviceId),
  })
);

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  cronExpression: varchar('cron_expression', { length: 255 }),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  repeatType: repeatTypeEnum('repeat_type').notNull().default('once'),
  conditions: jsonb('conditions'), // e.g. { batteryBelow: 20, signalAbove: -70, tempAbove: 60 }
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scheduleItems = pgTable('schedule_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id')
    .notNull()
    .references(() => schedules.id, { onDelete: 'cascade' }),
  mediaFileId: uuid('media_file_id').references(() => mediaFiles.id, {
    onDelete: 'set null',
  }),
  command: commandTypeEnum('command').notNull(),
  commandPayload: jsonb('command_payload'),
  orderIndex: integer('order_index').notNull(),
  durationSeconds: integer('duration_seconds'),
});

export const scheduleAssignments = pgTable(
  'schedule_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    scheduleDeviceIdx: uniqueIndex(
      'schedule_assignments_schedule_id_device_id_idx'
    ).on(t.scheduleId, t.deviceId),
  })
);

export const deviceCommands = pgTable(
  'device_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    command: varchar('command', { length: 255 }).notNull(),
    payload: jsonb('payload'),
    status: deviceCommandStatusEnum('status').notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    result: jsonb('result'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    deviceIdIdx: index('device_commands_device_id_idx').on(t.deviceId),
    statusIdx: index('device_commands_status_idx').on(t.status),
  })
);

// API Keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // first 8 chars for display
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  organization: one(organizations, { fields: [apiKeys.orgId], references: [organizations.id] }),
}));

export type ApiKey = InferSelectModel<typeof apiKeys>;
export type InsertApiKey = InferInsertModel<typeof apiKeys>;

// Auth tables (NextAuth.js compatible)
export const sessions = pgTable('sessions', {
  sessionToken: varchar('session_token', { length: 255 })
    .notNull()
    .primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: varchar('token_type', { length: 50 }),
    scope: text('scope'),
    id_token: text('id_token'),
  },
  (t) => ({
    userIdIdx: index('accounts_user_id_idx').on(t.userId),
    providerIdx: uniqueIndex('accounts_provider_account_id_idx').on(
      t.provider,
      t.providerAccountId
    ),
  })
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    identifierTokenIdx: primaryKey({
      columns: [t.identifier, t.token],
    }),
  })
);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  organizations: many(organizations),
  orgMembers: many(orgMembers),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const fleetsRelations = relations(fleets, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [fleets.orgId],
    references: [organizations.id],
  }),
  devices: many(devices),
}));

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    owner: one(users, {
      fields: [organizations.ownerId],
      references: [users.id],
    }),
    members: many(orgMembers),
    fleets: many(fleets),
    devices: many(devices),
    mediaFiles: many(mediaFiles),
    schedules: many(schedules),
  })
);

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const devicesRelations = relations(devices, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [devices.orgId],
    references: [organizations.id],
  }),
  fleet: one(fleets, {
    fields: [devices.fleetId],
    references: [fleets.id],
  }),
  tokens: many(deviceTokens),
  telemetryRecords: many(telemetryRecords),
  gpsRecords: many(gpsRecords),
  mediaFiles: many(mediaFiles),
  scheduleAssignments: many(scheduleAssignments),
  commands: many(deviceCommands),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  device: one(devices, {
    fields: [deviceTokens.deviceId],
    references: [devices.id],
  }),
}));

export const telemetryRecordsRelations = relations(
  telemetryRecords,
  ({ one }) => ({
    device: one(devices, {
      fields: [telemetryRecords.deviceId],
      references: [devices.id],
    }),
  })
);

export const gpsRecordsRelations = relations(gpsRecords, ({ one }) => ({
  device: one(devices, {
    fields: [gpsRecords.deviceId],
    references: [devices.id],
  }),
}));

export const mediaFilesRelations = relations(mediaFiles, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [mediaFiles.orgId],
    references: [organizations.id],
  }),
  device: one(devices, {
    fields: [mediaFiles.deviceId],
    references: [devices.id],
  }),
  scheduleItems: many(scheduleItems),
}));

export const schedulesRelations = relations(
  schedules,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [schedules.orgId],
      references: [organizations.id],
    }),
    items: many(scheduleItems),
    assignments: many(scheduleAssignments),
  })
);

export const scheduleItemsRelations = relations(
  scheduleItems,
  ({ one }) => ({
    schedule: one(schedules, {
      fields: [scheduleItems.scheduleId],
      references: [schedules.id],
    }),
    mediaFile: one(mediaFiles, {
      fields: [scheduleItems.mediaFileId],
      references: [mediaFiles.id],
    }),
  })
);

export const scheduleAssignmentsRelations = relations(
  scheduleAssignments,
  ({ one }) => ({
    schedule: one(schedules, {
      fields: [scheduleAssignments.scheduleId],
      references: [schedules.id],
    }),
    device: one(devices, {
      fields: [scheduleAssignments.deviceId],
      references: [devices.id],
    }),
  })
);

export const deviceCommandsRelations = relations(
  deviceCommands,
  ({ one }) => ({
    device: one(devices, {
      fields: [deviceCommands.deviceId],
      references: [devices.id],
    }),
  })
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Type exports
export type Fleet = InferSelectModel<typeof fleets>;
export type InsertFleet = InferInsertModel<typeof fleets>;

export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

export type Organization = InferSelectModel<typeof organizations>;
export type InsertOrganization = InferInsertModel<typeof organizations>;

export type OrgMember = InferSelectModel<typeof orgMembers>;
export type InsertOrgMember = InferInsertModel<typeof orgMembers>;

export type Device = InferSelectModel<typeof devices>;
export type InsertDevice = InferInsertModel<typeof devices>;

export type DeviceToken = InferSelectModel<typeof deviceTokens>;
export type InsertDeviceToken = InferInsertModel<typeof deviceTokens>;

export type TelemetryRecord = InferSelectModel<typeof telemetryRecords>;
export type InsertTelemetryRecord = InferInsertModel<typeof telemetryRecords>;

export type GpsRecord = InferSelectModel<typeof gpsRecords>;
export type InsertGpsRecord = InferInsertModel<typeof gpsRecords>;

export type MediaFile = InferSelectModel<typeof mediaFiles>;
export type InsertMediaFile = InferInsertModel<typeof mediaFiles>;

export type Schedule = InferSelectModel<typeof schedules>;
export type InsertSchedule = InferInsertModel<typeof schedules>;

export type ScheduleItem = InferSelectModel<typeof scheduleItems>;
export type InsertScheduleItem = InferInsertModel<typeof scheduleItems>;

export type ScheduleAssignment = InferSelectModel<typeof scheduleAssignments>;
export type InsertScheduleAssignment = InferInsertModel<
  typeof scheduleAssignments
>;

export type DeviceCommand = InferSelectModel<typeof deviceCommands>;
export type InsertDeviceCommand = InferInsertModel<typeof deviceCommands>;

export type Session = InferSelectModel<typeof sessions>;
export type InsertSession = InferInsertModel<typeof sessions>;

export type Account = InferSelectModel<typeof accounts>;
export type InsertAccount = InferInsertModel<typeof accounts>;

export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type InsertVerificationToken = InferInsertModel<typeof verificationTokens>;

// ============================================================================
// Audit Logs — Immutable event trail
// ============================================================================

export const auditActionEnum = pgEnum('audit_action', [
  'device_created',
  'device_updated',
  'device_deleted',
  'device_paired',
  'device_connected',
  'device_disconnected',
  'command_sent',
  'command_completed',
  'command_failed',
  'command_timeout',
  'settings_changed',
  'user_login',
  'user_logout',
  'firmware_updated',
  'config_changed',
  'alert_triggered',
  'media_uploaded',
  'device_rebooted',
  'factory_reset',
]);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    action: auditActionEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: varchar('entity_id', { length: 255 }),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdIdx: index('audit_logs_org_id_idx').on(t.orgId),
    deviceIdIdx: index('audit_logs_device_id_idx').on(t.deviceId),
    actionIdx: index('audit_logs_action_idx').on(t.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  })
);

// ============================================================================
// Device Settings — Per-device feature toggles and configuration
// ============================================================================

export const deviceSettings = pgTable(
  'device_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .unique()
      .references(() => devices.id, { onDelete: 'cascade' }),
    cameraEnabled: boolean('camera_enabled').notNull().default(true),
    audioEnabled: boolean('audio_enabled').notNull().default(false),
    gpsEnabled: boolean('gps_enabled').notNull().default(true),
    lteEnabled: boolean('lte_enabled').notNull().default(true),
    mqttEnabled: boolean('mqtt_enabled').notNull().default(false),
    heartbeatInterval: integer('heartbeat_interval').notNull().default(30000),
    gpsInterval: integer('gps_interval').notNull().default(60000),
    cameraResolution: varchar('camera_resolution', { length: 20 }).notNull().default('QVGA'),
    audioSampleRate: integer('audio_sample_rate').notNull().default(16000),
    powerMode: varchar('power_mode', { length: 20 }).notNull().default('active'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deviceIdIdx: index('device_settings_device_id_idx').on(t.deviceId),
  })
);

// ============================================================================
// Alert Rules — Automated monitoring thresholds
// ============================================================================

export const alertOperatorEnum = pgEnum('alert_operator', ['lt', 'gt', 'eq']);
export const alertActionEnum = pgEnum('alert_action_type', ['log', 'webhook', 'command']);

export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    metric: varchar('metric', { length: 50 }).notNull(),
    operator: alertOperatorEnum('operator').notNull(),
    threshold: real('threshold').notNull(),
    action: alertActionEnum('action').notNull().default('log'),
    enabled: boolean('enabled').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdIdx: index('alert_rules_org_id_idx').on(t.orgId),
    deviceIdIdx: index('alert_rules_device_id_idx').on(t.deviceId),
  })
);

// Types
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type InsertAuditLog = InferInsertModel<typeof auditLogs>;

export type DeviceSettings = InferSelectModel<typeof deviceSettings>;
export type InsertDeviceSettings = InferInsertModel<typeof deviceSettings>;

export type AlertRule = InferSelectModel<typeof alertRules>;
export type InsertAlertRule = InferInsertModel<typeof alertRules>;

// ============================================================================
// Webhooks — External event notification system
// ============================================================================

export const webhookEventEnum = pgEnum('webhook_event', [
  'device_online',
  'device_offline',
  'command_completed',
  'alert_triggered',
  'low_battery',
]);

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    events: jsonb('events').notNull(), // array of webhook event strings
    secret: varchar('secret', { length: 255 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdIdx: index('webhooks_org_id_idx').on(t.orgId),
  })
);

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  organization: one(organizations, {
    fields: [webhooks.orgId],
    references: [organizations.id],
  }),
}));

// Types
export type Webhook = InferSelectModel<typeof webhooks>;
export type InsertWebhook = InferInsertModel<typeof webhooks>;

// ============================================================================
// Protocol Routing Settings — Per-org data-to-protocol mapping
// ============================================================================

export const protocolSettings = pgTable(
  'protocol_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    dataType: varchar('data_type', { length: 50 }).notNull(), // telemetry, gps, media, commands, status, alerts
    websocketEnabled: boolean('websocket_enabled').notNull().default(true),
    mqttEnabled: boolean('mqtt_enabled').notNull().default(false),
    httpEnabled: boolean('http_enabled').notNull().default(false),
    config: jsonb('config'), // extra per-protocol config (topic overrides, endpoints)
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgDataIdx: uniqueIndex('protocol_settings_org_data_idx').on(t.orgId, t.dataType),
  })
);

export type ProtocolSetting = InferSelectModel<typeof protocolSettings>;
export type InsertProtocolSetting = InferInsertModel<typeof protocolSettings>;

// Aliases for backward compatibility with API routes
export const telemetry = telemetryRecords;
export const gpsData = gpsRecords;

// ============================================================================
// Platform Admin — SaaS operator super-role
// ============================================================================

export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  permissions: jsonb('permissions'), // granular overrides (optional)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformAdmin = InferSelectModel<typeof platformAdmins>;

// ============================================================================
// OTP / 2FA — TOTP secrets for user accounts
// ============================================================================

export const userOtpSecrets = pgTable('user_otp_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: varchar('secret', { length: 255 }).notNull(), // encrypted TOTP secret
  enabled: boolean('enabled').notNull().default(false),
  backupCodes: jsonb('backup_codes'), // array of hashed backup codes
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserOtpSecret = InferSelectModel<typeof userOtpSecrets>;

// ============================================================================
// Notifications — In-app + email notification system
// ============================================================================

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'both',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'info',
  'warning',
  'error',
  'success',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull().default('info'),
    channel: notificationChannelEnum('channel').notNull().default('in_app'),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    read: boolean('read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('notifications_user_id_idx').on(t.userId),
    orgIdx: index('notifications_org_id_idx').on(t.orgId),
  })
);

export type Notification = InferSelectModel<typeof notifications>;
export type InsertNotification = InferInsertModel<typeof notifications>;

// ============================================================================
// Commerce — Products & Catalog
// ============================================================================

export const productStatusEnum = pgEnum('product_status', ['active', 'draft', 'archived']);

export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  parentId: uuid('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    sku: varchar('sku', { length: 100 }),
    price: integer('price').notNull().default(0), // cents
    compareAtPrice: integer('compare_at_price'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
    images: jsonb('images'), // string[]
    status: productStatusEnum('status').notNull().default('draft'),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    trackInventory: boolean('track_inventory').notNull().default(true),
    weight: real('weight'),
    dimensions: jsonb('dimensions'), // { length, width, height }
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('products_org_id_idx').on(t.orgId),
    slugIdx: index('products_slug_idx').on(t.slug),
  })
);

export type Product = InferSelectModel<typeof products>;
export type InsertProduct = InferInsertModel<typeof products>;

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  price: integer('price').notNull().default(0),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  options: jsonb('options'), // { color: 'red', size: 'L' }
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Commerce — Customers
// ============================================================================

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    company: varchar('company', { length: 255 }),
    address: jsonb('address'), // { street, city, state, zip, country }
    totalOrders: integer('total_orders').notNull().default(0),
    totalSpent: integer('total_spent').notNull().default(0), // cents
    tags: jsonb('tags'), // string[]
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('customers_org_id_idx').on(t.orgId),
    emailIdx: index('customers_email_idx').on(t.email),
  })
);

export type Customer = InferSelectModel<typeof customers>;
export type InsertCustomer = InferInsertModel<typeof customers>;

// ============================================================================
// Commerce — Orders
// ============================================================================

export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
]);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    orderNumber: varchar('order_number', { length: 50 }).notNull(),
    status: orderStatusEnum('status').notNull().default('pending'),
    subtotal: integer('subtotal').notNull().default(0),
    taxAmount: integer('tax_amount').notNull().default(0),
    shippingAmount: integer('shipping_amount').notNull().default(0),
    discountAmount: integer('discount_amount').notNull().default(0),
    total: integer('total').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    shippingAddress: jsonb('shipping_address'),
    billingAddress: jsonb('billing_address'),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('orders_org_id_idx').on(t.orgId),
    numberIdx: index('orders_number_idx').on(t.orderNumber),
  })
);

export type Order = InferSelectModel<typeof orders>;
export type InsertOrder = InferInsertModel<typeof orders>;

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  totalPrice: integer('total_price').notNull().default(0),
  metadata: jsonb('metadata'),
});

export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: orderStatusEnum('status').notNull(),
  note: text('note'),
  changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Commerce — Payments & Invoices
// ============================================================================

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'succeeded', 'failed', 'refunded',
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  amount: integer('amount').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  method: varchar('method', { length: 50 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  stripeRefundId: varchar('stripe_refund_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'sent', 'paid', 'overdue', 'cancelled',
]);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    subtotal: integer('subtotal').notNull().default(0),
    taxAmount: integer('tax_amount').notNull().default(0),
    total: integer('total').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    lineItems: jsonb('line_items'), // array of { description, quantity, unitPrice, total }
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('invoices_org_id_idx').on(t.orgId),
  })
);

export type Invoice = InferSelectModel<typeof invoices>;
export type InsertInvoice = InferInsertModel<typeof invoices>;

// ============================================================================
// Commerce — Shipping
// ============================================================================

export const shippingMethods = pgTable('shipping_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  carrier: varchar('carrier', { length: 100 }),
  estimatedDays: integer('estimated_days'),
  price: integer('price').notNull().default(0),
  freeAbove: integer('free_above'), // free shipping above this amount
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'pending', 'shipped', 'in_transit', 'delivered',
]);

export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  shippingMethodId: uuid('shipping_method_id').references(() => shippingMethods.id, { onDelete: 'set null' }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  carrier: varchar('carrier', { length: 100 }),
  status: shipmentStatusEnum('status').notNull().default('pending'),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Commerce — Tax
// ============================================================================

export const taxRates = pgTable('tax_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  region: varchar('region', { length: 100 }),
  rate: real('rate').notNull(), // e.g., 0.13 for 13%
  type: varchar('type', { length: 20 }).notNull().default('exclusive'), // inclusive or exclusive
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taxExemptions = pgTable('tax_exemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  certificateNumber: varchar('certificate_number', { length: 100 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Commerce — Promo Codes
// ============================================================================

export const promoTypeEnum = pgEnum('promo_type', ['percentage', 'fixed', 'free_shipping']);

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 50 }).notNull(),
    type: promoTypeEnum('type').notNull(),
    value: integer('value').notNull(), // percentage (0-100) or fixed amount in cents
    minOrderAmount: integer('min_order_amount'),
    maxUses: integer('max_uses'),
    usedCount: integer('used_count').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex('promo_codes_code_idx').on(t.code),
  })
);

export type PromoCode = InferSelectModel<typeof promoCodes>;
export type InsertPromoCode = InferInsertModel<typeof promoCodes>;

// ============================================================================
// Commerce — Cart
// ============================================================================

export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  sessionId: varchar('session_id', { length: 255 }),
  items: jsonb('items'), // array of { productId, variantId, quantity, price }
  subtotal: integer('subtotal').notNull().default(0),
  abandonedAt: timestamp('abandoned_at', { withTimezone: true }),
  recoveryEmailSentAt: timestamp('recovery_email_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Commerce — Inventory
// ============================================================================

export const inventoryMovementTypeEnum = pgEnum('inventory_movement_type', ['in', 'out', 'adjustment']);

export const inventoryMovements = pgTable('inventory_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  type: inventoryMovementTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  reason: varchar('reason', { length: 255 }),
  reference: varchar('reference', { length: 255 }), // order ID, PO number, etc.
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// CRM — Contacts
// ============================================================================

export const contactStatusEnum = pgEnum('contact_status', [
  'new', 'contacted', 'qualified', 'converted', 'lost',
]);

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    company: varchar('company', { length: 255 }),
    title: varchar('title', { length: 255 }),
    source: varchar('source', { length: 100 }),
    status: contactStatusEnum('status').notNull().default('new'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    tags: jsonb('tags'),
    customFields: jsonb('custom_fields'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('contacts_org_id_idx').on(t.orgId),
    emailIdx: index('contacts_email_idx').on(t.email),
  })
);

export type Contact = InferSelectModel<typeof contacts>;
export type InsertContact = InferInsertModel<typeof contacts>;

export const contactNotes = pgTable('contact_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contactActivityTypeEnum = pgEnum('contact_activity_type', [
  'email', 'call', 'meeting', 'note',
]);

export const contactActivities = pgTable('contact_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  type: contactActivityTypeEnum('type').notNull(),
  subject: varchar('subject', { length: 255 }),
  description: text('description'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// CRM — Leads
// ============================================================================

export const leadStatusEnum = pgEnum('lead_status', [
  'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost',
]);

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    source: varchar('source', { length: 100 }),
    status: leadStatusEnum('status').notNull().default('new'),
    value: integer('value'), // deal value in cents
    probability: integer('probability'), // 0-100
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('leads_org_id_idx').on(t.orgId),
    statusIdx: index('leads_status_idx').on(t.status),
  })
);

export type Lead = InferSelectModel<typeof leads>;
export type InsertLead = InferInsertModel<typeof leads>;

// ============================================================================
// CRM — Lead Forms
// ============================================================================

export const leadForms = pgTable('lead_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  fields: jsonb('fields').notNull(), // array of { name, type, label, required }
  redirectUrl: varchar('redirect_url', { length: 500 }),
  active: boolean('active').notNull().default(true),
  submissions: integer('submissions').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leadFormSubmissions = pgTable('lead_form_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  formId: uuid('form_id').notNull().references(() => leadForms.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  convertedLeadId: uuid('converted_lead_id').references(() => leads.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Marketing — Campaigns
// ============================================================================

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft', 'scheduled', 'active', 'paused', 'completed',
]);

export const campaignTypeEnum = pgEnum('campaign_type', ['email', 'sms', 'push']);

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: campaignTypeEnum('type').notNull().default('email'),
    status: campaignStatusEnum('status').notNull().default('draft'),
    subject: varchar('subject', { length: 255 }),
    content: text('content'),
    audience: jsonb('audience'), // filter criteria
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    stats: jsonb('stats'), // { sent, opened, clicked, bounced, unsubscribed }
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('campaigns_org_id_idx').on(t.orgId),
  })
);

export type Campaign = InferSelectModel<typeof campaigns>;
export type InsertCampaign = InferInsertModel<typeof campaigns>;

// ============================================================================
// CRM — Lead Scoring
// ============================================================================

export const leadScoringRules = pgTable('lead_scoring_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  condition: jsonb('condition').notNull(), // { field, operator, value }
  points: integer('points').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Analytics
// ============================================================================

export const pageViews = pgTable('page_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  path: varchar('path', { length: 500 }).notNull(),
  referrer: varchar('referrer', { length: 500 }),
  userAgent: text('user_agent'),
  ip: varchar('ip', { length: 45 }),
  sessionId: varchar('session_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    properties: jsonb('properties'),
    sessionId: varchar('session_id', { length: 255 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('analytics_events_org_id_idx').on(t.orgId),
    nameIdx: index('analytics_events_name_idx').on(t.name),
  })
);

// ============================================================================
// SEO Settings
// ============================================================================

export const seoSettings = pgTable('seo_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  defaultTitle: varchar('default_title', { length: 255 }),
  defaultDescription: text('default_description'),
  ogImage: varchar('og_image', { length: 500 }),
  robots: text('robots'),
  googleAnalyticsId: varchar('google_analytics_id', { length: 50 }),
  sitemap: jsonb('sitemap'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Domains
// ============================================================================

export const domains = pgTable('domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 255 }).notNull(),
  verified: boolean('verified').notNull().default(false),
  primary: boolean('primary').notNull().default(false),
  sslStatus: varchar('ssl_status', { length: 50 }),
  dnsRecords: jsonb('dns_records'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Operations — Feature Flags
// ============================================================================

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(false),
  rolloutPercentage: integer('rollout_percentage').notNull().default(0),
  targetOrgs: jsonb('target_orgs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type FeatureFlag = InferSelectModel<typeof featureFlags>;

// ============================================================================
// Development — Tickets
// ============================================================================

export const devTicketStatusEnum = pgEnum('dev_ticket_status', [
  'open', 'in_progress', 'review', 'done', 'closed',
]);

export const devTicketPriorityEnum = pgEnum('dev_ticket_priority', [
  'low', 'medium', 'high', 'critical',
]);

export const devTickets = pgTable(
  'dev_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: devTicketStatusEnum('status').notNull().default('open'),
    priority: devTicketPriorityEnum('priority').notNull().default('medium'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    labels: jsonb('labels'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('dev_tickets_org_id_idx').on(t.orgId),
  })
);

export type DevTicket = InferSelectModel<typeof devTickets>;

// ============================================================================
// Development — Repair Plans
// ============================================================================

export const repairPlanStatusEnum = pgEnum('repair_plan_status', [
  'planned', 'in_progress', 'completed',
]);

export const repairPlans = pgTable('repair_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: repairPlanStatusEnum('status').notNull().default('planned'),
  steps: jsonb('steps'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Development — Version Releases
// ============================================================================

export const versionReleases = pgTable('version_releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: varchar('version', { length: 50 }).notNull(),
  releaseNotes: text('release_notes'),
  changelog: jsonb('changelog'),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releasedBy: uuid('released_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Development — Dev Wiki
// ============================================================================

export const devWikiPages = pgTable(
  'dev_wiki_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    content: text('content'),
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgSlugIdx: index('dev_wiki_org_slug_idx').on(t.orgId, t.slug),
  })
);

export type DevWikiPage = InferSelectModel<typeof devWikiPages>;
