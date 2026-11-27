import { and, eq, lte } from 'drizzle-orm';
import type { EventDto } from '@alerts/shared';
import type { Db } from '../db/client';
import {
  alerts,
  alertTargets,
  channels,
  deliveries,
  events,
  targets,
} from '../db/schema';
import {
  matchesFilters,
  type MatchAlert,
  type MatchEvent,
} from '../matching/match';
import type { NewEvent } from '../sources/source';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type DeliveryInsert = typeof deliveries.$inferInsert;

export type EventRow = typeof events.$inferSelect;

export interface IngestResult {
  event: EventRow;
  deliveriesCreated: number;
}

export function toEventDto(row: EventRow): EventDto {
  // Ingest validated category and data together, which the column types cannot express.
  return {
    id: row.id,
    sourceId: row.sourceId,
    category: row.category,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    data: row.data,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  } as EventDto;
}

// Returns the number of delivery rows inserted. Rows that already exist are left alone (R9).
export async function matchEvent(tx: Tx, event: EventRow): Promise<number> {
  const candidates = await tx
    .select({
      alertId: alerts.id,
      category: alerts.category,
      minSeverity: alerts.minSeverity,
      filters: alerts.filters,
      targetId: targets.id,
      channel: targets.channel,
    })
    .from(alerts)
    .innerJoin(alertTargets, eq(alertTargets.alertId, alerts.id))
    .innerJoin(targets, eq(targets.id, alertTargets.targetId))
    .where(
      and(
        eq(alerts.enabled, true),
        eq(alerts.category, event.category),
        lte(alerts.minSeverity, event.severity),
      ),
    )
    // A concurrent alert or target delete waits, so the delivery insert never hits a missing row.
    .for('key share', { of: [alerts, targets] });

  // Ingest and the alert routes validated category with data and filters, which the column types cannot express.
  const matched = candidates.filter((row) =>
    matchesFilters(event as MatchEvent, row as MatchAlert),
  );
  if (matched.length === 0) {
    return 0;
  }

  const enabledChannels = new Set(
    (
      await tx
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.enabled, true))
    ).map((row) => row.id),
  );
  const rows = matched.map(
    ({ alertId, targetId, channel }): DeliveryInsert => {
      const enabled = enabledChannels.has(channel);
      return {
        alertId,
        eventId: event.id,
        targetId,
        channel,
        status: enabled ? 'pending' : 'skipped',
        attempts: 0,
        lastError: enabled ? null : 'channel disabled',
      };
    },
  );
  const inserted = await tx
    .insert(deliveries)
    .values(rows)
    .onConflictDoNothing({
      target: [deliveries.alertId, deliveries.eventId, deliveries.targetId],
    })
    .returning({ id: deliveries.id });
  return inserted.length;
}

// Returns null when the source already delivered an event with this externalId.
export async function ingestEvent(
  db: Db,
  event: NewEvent,
): Promise<IngestResult | null> {
  return db.transaction(async (tx) => {
    const [stored] = await tx
      .insert(events)
      .values({
        sourceId: event.sourceId,
        externalId: event.externalId,
        category: event.category,
        title: event.title,
        summary: event.summary,
        severity: event.severity,
        data: event.data,
        occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
      })
      .onConflictDoNothing({ target: [events.sourceId, events.externalId] })
      .returning();
    if (!stored) {
      return null;
    }
    return { event: stored, deliveriesCreated: await matchEvent(tx, stored) };
  });
}
