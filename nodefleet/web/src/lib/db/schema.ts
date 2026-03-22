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

// Aliases for backward compatibility with API routes
export const telemetry = telemetryRecords;
export const gpsData = gpsRecords;
