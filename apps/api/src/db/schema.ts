import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  Category,
  ChannelId,
  DeliveryStatus,
  Role,
  type AlertInput,
  type EventInput,
  type TargetInput,
} from '@alerts/shared';

// Values come from the shared enums, never from user input.
function inList(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

// Drizzle wants a non-empty tuple, zod's options is a plain array.
function values<T extends string>(options: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = options;
  if (first === undefined) {
    throw new Error('An enum column needs at least one value');
  }
  return [first, ...rest];
}

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique('users_email_unique'),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: values(Role.options) }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('users_email_lowercase_check', sql`${t.email} = lower(${t.email})`),
    check('users_role_check', sql`${t.role} in (${inList(Role.options)})`),
  ],
);

export const targets = pgTable('targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  channel: text('channel', { enum: values(ChannelId.options) }).notNull(),
  config: jsonb('config').$type<TargetInput['config']>().notNull(),
  createdAt: createdAt(),
});

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category', { enum: values(Category.options) }).notNull(),
    filters: jsonb('filters').$type<AlertInput['filters']>().notNull(),
    minSeverity: integer('min_severity').notNull(),
    enabled: boolean('enabled').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'alerts_min_severity_check',
      sql`${t.minSeverity} between 1 and 5`,
    ),
  ],
);

export const alertTargets = pgTable(
  'alert_targets',
  {
    alertId: uuid('alert_id')
      .notNull()
      .references(() => alerts.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => targets.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.alertId, t.targetId] })],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // No foreign key, so injected events can use 'dev'.
    sourceId: text('source_id').notNull(),
    externalId: text('external_id').notNull(),
    category: text('category', { enum: values(Category.options) }).notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    severity: integer('severity').notNull(),
    data: jsonb('data').$type<EventInput['data']>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('events_source_id_external_id_unique').on(t.sourceId, t.externalId),
    // NULLS FIRST matches a plain ORDER BY created_at DESC, so the index serves it.
    index('events_category_created_at_idx').on(
      t.category,
      t.createdAt.desc().nullsFirst(),
    ),
    check('events_severity_check', sql`${t.severity} between 1 and 5`),
  ],
);

export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  category: text('category', { enum: values(Category.options) }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: updatedAt(),
});

export const channels = pgTable('channels', {
  id: text('id', { enum: values(ChannelId.options) }).primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: updatedAt(),
});

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    alertId: uuid('alert_id')
      .notNull()
      .references(() => alerts.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => targets.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: values(ChannelId.options) }).notNull(),
    status: text('status', { enum: values(DeliveryStatus.options) }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set fresh by every claim; result writes must match it.
    claimToken: uuid('claim_token'),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('deliveries_alert_id_event_id_target_id_unique').on(
      t.alertId,
      t.eventId,
      t.targetId,
    ),
    index('deliveries_status_next_attempt_at_idx').on(
      t.status,
      t.nextAttemptAt,
    ),
    check(
      'deliveries_status_check',
      sql`${t.status} in (${inList(DeliveryStatus.options)})`,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
