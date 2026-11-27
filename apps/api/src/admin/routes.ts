import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  AdminAlertsQuery,
  AdminDeliveriesQuery,
  AdminEventsQuery,
  Category,
  ChannelIdParam,
  DeliveryStatus,
  IdParam,
  ListQuery,
  PatchEnabled,
  SourceIdParam,
  type AdminUserDto,
  type ChannelDto,
  type ChannelId,
  type DeliveryDto,
  type MetricsDto,
  type SourceDto,
} from '@alerts/shared';
import { listAlerts } from '../alerts/routes';
import { requireAdmin } from '../auth/guards';
import type { Db } from '../db/client';
import {
  alerts,
  channels,
  deliveries,
  events,
  sources,
  targets,
  users,
} from '../db/schema';
import { toEventDto } from '../events/ingest';
import { HttpError } from '../http-error';

const METRICS_WINDOW_MS = 24 * 60 * 60 * 1000;
const RETRYABLE: DeliveryStatus[] = ['failed', 'dead', 'skipped'];

const adminOnly = { preHandler: requireAdmin };

function zeroes<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function toSourceDto(row: typeof sources.$inferSelect): SourceDto {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

function toChannelDto(row: typeof channels.$inferSelect): ChannelDto {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

// Selects target.name but never target.config, which holds the webhook URL.
async function selectDeliveries(
  db: Db,
  where: SQL | undefined,
  limit: number,
): Promise<DeliveryDto[]> {
  const rows = await db
    .select({
      id: deliveries.id,
      alertId: deliveries.alertId,
      eventId: deliveries.eventId,
      targetId: deliveries.targetId,
      channel: deliveries.channel,
      status: deliveries.status,
      attempts: deliveries.attempts,
      nextAttemptAt: deliveries.nextAttemptAt,
      lastError: deliveries.lastError,
      sentAt: deliveries.sentAt,
      createdAt: deliveries.createdAt,
      updatedAt: deliveries.updatedAt,
      eventTitle: events.title,
      alertName: alerts.name,
      targetName: targets.name,
      userEmail: users.email,
    })
    .from(deliveries)
    .innerJoin(events, eq(events.id, deliveries.eventId))
    .innerJoin(alerts, eq(alerts.id, deliveries.alertId))
    .innerJoin(targets, eq(targets.id, deliveries.targetId))
    .innerJoin(users, eq(users.id, alerts.userId))
    .where(where)
    .orderBy(desc(deliveries.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users', adminOnly, async (request): Promise<AdminUserDto[]> => {
    const { limit } = ListQuery.parse(request.query);
    const rows = await app.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        alertCount: count(alerts.id),
      })
      .from(users)
      .leftJoin(alerts, eq(alerts.userId, users.id))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  });

  app.get('/alerts', adminOnly, async (request) => {
    const { userId, limit } = AdminAlertsQuery.parse(request.query);
    return listAlerts(app.db, userId, limit);
  });

  app.get('/events', adminOnly, async (request) => {
    const { category, limit } = AdminEventsQuery.parse(request.query);
    const rows = await app.db
      .select()
      .from(events)
      .where(category ? eq(events.category, category) : undefined)
      .orderBy(desc(events.createdAt))
      .limit(limit);
    return rows.map(toEventDto);
  });

  app.get('/deliveries', adminOnly, async (request) => {
    const { status, channel, limit } = AdminDeliveriesQuery.parse(
      request.query,
    );
    return selectDeliveries(
      app.db,
      and(
        status ? eq(deliveries.status, status) : undefined,
        channel ? eq(deliveries.channel, channel) : undefined,
      ),
      limit,
    );
  });

  app.post(
    '/deliveries/:id/retry',
    adminOnly,
    async (request): Promise<DeliveryDto> => {
      const { id } = IdParam.parse(request.params);
      const [retried] = await app.db
        .update(deliveries)
        .set({
          status: 'pending',
          attempts: 0,
          nextAttemptAt: sql`now()`,
          lastError: null,
          claimToken: null,
        })
        .where(
          and(eq(deliveries.id, id), inArray(deliveries.status, RETRYABLE)),
        )
        .returning({ id: deliveries.id });
      if (!retried) {
        const [existing] = await app.db
          .select({ id: deliveries.id })
          .from(deliveries)
          .where(eq(deliveries.id, id))
          .limit(1);
        throw existing
          ? new HttpError(
              409,
              'Only a failed, dead or skipped delivery can be retried',
            )
          : new HttpError(404, 'Delivery not found');
      }
      const [delivery] = await selectDeliveries(
        app.db,
        eq(deliveries.id, id),
        1,
      );
      if (!delivery) {
        throw new HttpError(404, 'Delivery not found');
      }
      return delivery;
    },
  );

  app.get('/sources', adminOnly, async () => {
    const rows = await app.db.select().from(sources).orderBy(asc(sources.id));
    return rows.map(toSourceDto);
  });

  app.patch('/sources/:id', adminOnly, async (request) => {
    const { id } = SourceIdParam.parse(request.params);
    const { enabled } = PatchEnabled.parse(request.body);
    const [row] = await app.db
      .update(sources)
      .set({ enabled })
      .where(eq(sources.id, id))
      .returning();
    if (!row) {
      throw new HttpError(404, 'Source not found');
    }
    return toSourceDto(row);
  });

  app.get('/channels', adminOnly, async () => {
    const rows = await app.db.select().from(channels).orderBy(asc(channels.id));
    return rows.map(toChannelDto);
  });

  app.patch('/channels/:id', adminOnly, async (request) => {
    // The ChannelId enum is the channel registry, so an id outside it is an unknown channel.
    const params = ChannelIdParam.safeParse(request.params);
    if (!params.success) {
      throw new HttpError(404, 'Channel not found');
    }
    const { enabled } = PatchEnabled.parse(request.body);
    const [row] = await app.db
      .update(channels)
      .set({ enabled })
      .where(eq(channels.id, params.data.id))
      .returning();
    if (!row) {
      throw new HttpError(404, 'Channel not found');
    }
    return toChannelDto(row);
  });

  app.get('/metrics', adminOnly, async (): Promise<MetricsDto> => {
    const since = new Date(Date.now() - METRICS_WINDOW_MS);
    const [eventRows, deliveryRows] = await Promise.all([
      app.db
        .select({ category: events.category, count: count() })
        .from(events)
        .where(gte(events.createdAt, since))
        .groupBy(events.category),
      app.db
        .select({
          channel: deliveries.channel,
          status: deliveries.status,
          count: count(),
        })
        .from(deliveries)
        .where(gte(deliveries.createdAt, since))
        .groupBy(deliveries.channel, deliveries.status),
    ]);

    const eventsByCategory = zeroes(Category.options);
    for (const row of eventRows) {
      eventsByCategory[row.category] += row.count;
    }
    const deliveriesByStatus = zeroes(DeliveryStatus.options);
    for (const row of deliveryRows) {
      deliveriesByStatus[row.status] += row.count;
    }
    const countOf = (channel: ChannelId, status: DeliveryStatus): number =>
      deliveryRows.find(
        (row) => row.channel === channel && row.status === status,
      )?.count ?? 0;
    const channelIds = Object.keys(app.channels) as ChannelId[];
    const failureRateByChannel = zeroes(channelIds);
    for (const channel of channelIds) {
      const sent = countOf(channel, 'sent');
      const dead = countOf(channel, 'dead');
      failureRateByChannel[channel] =
        sent + dead === 0 ? 0 : dead / (sent + dead);
    }

    return {
      since: since.toISOString(),
      eventsByCategory,
      deliveriesByStatus,
      failureRateByChannel,
    };
  });
}
