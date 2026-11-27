import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { FastifyBaseLogger } from 'fastify';
import { sendThroughChannel, type ChannelRegistry } from '../channels/registry';
import type { Config } from '../config';
import type { Db } from '../db/client';
import {
  alerts,
  channels as channelRows,
  deliveries,
  events,
  targets,
} from '../db/schema';
import { computeBackoff } from './backoff';
import { buildMessage, type MessageEvent } from './message';
import { safeErrorLog } from '../safe-error-log';

const CLAIM_LIMIT = 10;

export interface WorkerDeps {
  db: Db;
  channels: ChannelRegistry;
  config: Pick<
    Config,
    | 'WORKER_POLL_MS'
    | 'DELIVERY_MAX_ATTEMPTS'
    | 'DELIVERY_BACKOFF_BASE_MS'
    | 'DELIVERY_LEASE_MS'
    | 'DELIVERY_SEND_TIMEOUT_MS'
  >;
  logger: Pick<FastifyBaseLogger, 'debug' | 'error'>;
  random?: () => number;
}

export interface DeliveryWorker {
  tick(): Promise<void>;
  start(): void;
  // Resolves once the running tick, if any, has ended.
  stop(): Promise<void>;
}

interface ClaimedRow {
  id: string;
  attempts: number;
  claimToken: string;
}

// Uses the database clock, the same one the claim compares against.
function msFromNow(ms: number) {
  return sql`now() + make_interval(secs => ${ms / 1000})`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Send failed';
}

export function createWorker(deps: WorkerDeps): DeliveryWorker {
  const { db, channels, config, logger, random = Math.random } = deps;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopped = true;

  async function expireLeasesAtMax(): Promise<void> {
    await db
      .update(deliveries)
      .set({ status: 'dead', lastError: 'lease expired' })
      .where(
        and(
          eq(deliveries.status, 'sending'),
          lte(deliveries.nextAttemptAt, sql`now()`),
          gte(deliveries.attempts, config.DELIVERY_MAX_ATTEMPTS),
        ),
      );
  }

  async function claim(): Promise<ClaimedRow[]> {
    const due = db
      .select({ id: deliveries.id })
      .from(deliveries)
      .innerJoin(channelRows, eq(channelRows.id, deliveries.channel))
      .where(
        and(
          eq(channelRows.enabled, true),
          lt(deliveries.attempts, config.DELIVERY_MAX_ATTEMPTS),
          lte(deliveries.nextAttemptAt, sql`now()`),
          inArray(deliveries.status, ['pending', 'failed', 'sending']),
        ),
      )
      .orderBy(asc(deliveries.nextAttemptAt))
      .limit(CLAIM_LIMIT)
      // Without "of", the lock would also cover the channels row and skip every delivery behind it.
      .for('update', { of: deliveries, skipLocked: true });
    const rows = await db
      .update(deliveries)
      .set({
        status: 'sending',
        attempts: sql`${deliveries.attempts} + 1`,
        nextAttemptAt: msFromNow(config.DELIVERY_LEASE_MS),
        claimToken: sql`gen_random_uuid()`,
      })
      .where(inArray(deliveries.id, due))
      .returning({
        id: deliveries.id,
        attempts: deliveries.attempts,
        claimToken: deliveries.claimToken,
      });
    // The claim has just set every token, so none is null.
    return rows as ClaimedRow[];
  }

  async function loadDetails(ids: string[]) {
    const rows = await db
      .select({
        id: deliveries.id,
        channel: targets.channel,
        config: targets.config,
        alertName: alerts.name,
        category: events.category,
        title: events.title,
        summary: events.summary,
        severity: events.severity,
        data: events.data,
      })
      .from(deliveries)
      .innerJoin(targets, eq(targets.id, deliveries.targetId))
      .innerJoin(alerts, eq(alerts.id, deliveries.alertId))
      .innerJoin(events, eq(events.id, deliveries.eventId))
      .where(inArray(deliveries.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }

  // The fence drops the result when a newer claim owns the row.
  async function recordResult(
    row: ClaimedRow,
    outcome: PromiseSettledResult<void>,
  ): Promise<void> {
    let values: PgUpdateSetSource<typeof deliveries>;
    if (outcome.status === 'fulfilled') {
      values = { status: 'sent', sentAt: sql`now()`, lastError: null };
    } else if (row.attempts < config.DELIVERY_MAX_ATTEMPTS) {
      const backoffMs = computeBackoff(
        row.attempts,
        config.DELIVERY_BACKOFF_BASE_MS,
        random,
      );
      values = {
        status: 'failed',
        lastError: errorMessage(outcome.reason),
        nextAttemptAt: msFromNow(backoffMs),
      };
    } else {
      values = { status: 'dead', lastError: errorMessage(outcome.reason) };
    }
    const updated = await db
      .update(deliveries)
      .set(values)
      .where(
        and(
          eq(deliveries.id, row.id),
          eq(deliveries.status, 'sending'),
          eq(deliveries.claimToken, row.claimToken),
        ),
      )
      .returning({ id: deliveries.id });
    if (updated.length === 0) {
      logger.debug(
        { deliveryId: row.id, attempts: row.attempts },
        'Dropped a stale delivery result',
      );
    }
  }

  // Channel timeouts can be idle-only; this caps the total. The send itself is not cancelled.
  async function withDeadline(send: () => Promise<void>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('send timed out')),
        config.DELIVERY_SEND_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([send(), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function tick(): Promise<void> {
    await expireLeasesAtMax();
    const claimed = await claim();
    if (claimed.length === 0) {
      return;
    }
    const details = await loadDetails(claimed.map((row) => row.id));
    // A row without details was deleted after the claim, so nothing is left to record.
    const work = claimed.flatMap((row) => {
      const detail = details.get(row.id);
      return detail ? [{ row, detail }] : [];
    });
    // Each result is written as soon as its own send settles.
    const writes = await Promise.allSettled(
      work.map(async ({ row, detail }) => {
        const [outcome] = await Promise.allSettled([
          withDeadline(async () => {
            // Ingest validated category with data, which the column types cannot express.
            const event = detail as MessageEvent;
            await sendThroughChannel(
              channels,
              detail,
              buildMessage(event, detail.alertName),
            );
          }),
        ]);
        await recordResult(row, outcome);
      }),
    );
    for (const write of writes) {
      if (write.status === 'rejected') {
        logger.error(
          { error: safeErrorLog(write.reason) },
          'Recording a delivery result failed',
        );
      }
    }
  }

  function schedule(): void {
    if (stopped) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      running = tick()
        .catch((error: unknown) => {
          logger.error(
            { error: safeErrorLog(error) },
            'Delivery worker tick failed',
          );
        })
        .finally(() => {
          running = undefined;
          schedule();
        });
    }, config.WORKER_POLL_MS);
  }

  return {
    tick,
    start() {
      if (!stopped) {
        return;
      }
      stopped = false;
      schedule();
    },
    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
      await running;
    },
  };
}
