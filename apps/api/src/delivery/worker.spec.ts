import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { Pool } from 'pg';
import { ChannelId, EmailConfig, SlackConfig } from '@alerts/shared';
import type { NotificationMessage } from '../channels/channel';
import type { ChannelRegistry } from '../channels/registry';
import { loadConfig } from '../config';
import { createDb, type Db } from '../db/client';
import { syncRegistryRows } from '../db/registry-sync';
import {
  alerts,
  alertTargets,
  channels,
  deliveries,
  events,
  targets,
  users,
} from '../db/schema';
import { createWorker, type WorkerDeps } from './worker';

const SOURCE_ID = 'worker-test';
const BASE_MS = 1000;
// Room for the gap between the database clock and Date.now().
const CLOCK_SLACK_MS = 250;

type DeliveryInsert = typeof deliveries.$inferInsert;

describe('delivery worker', () => {
  let db: Db;
  let pool: Pool;
  let userIds: string[] = [];
  const send =
    vi.fn<(config: unknown, message: NotificationMessage) => Promise<void>>();
  const registry: ChannelRegistry = {
    email: { id: 'email', configSchema: EmailConfig, send },
    slack: { id: 'slack', configSchema: SlackConfig, send },
  };
  const logger = { debug: vi.fn(), error: vi.fn() };

  beforeAll(async () => {
    const config = loadConfig(process.env);
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    await syncRegistryRows(db, { channelIds: ChannelId.options, sources: [] });
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
    logger.debug.mockClear();
    logger.error.mockClear();
  });

  afterEach(async () => {
    // Deleting the users and events cascades to targets, alerts and deliveries.
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
    userIds = [];
    await db.delete(events).where(eq(events.sourceId, SOURCE_ID));
    await setChannelEnabled('email', true);
  });

  afterAll(async () => {
    await pool?.end();
  });

  function newWorker(config: Partial<WorkerDeps['config']> = {}) {
    return createWorker({
      db,
      channels: registry,
      config: {
        WORKER_POLL_MS: 10,
        DELIVERY_MAX_ATTEMPTS: 5,
        DELIVERY_BACKOFF_BASE_MS: BASE_MS,
        DELIVERY_LEASE_MS: 60_000,
        ...config,
      },
      logger,
      random: () => 0,
    });
  }

  async function setChannelEnabled(id: ChannelId, enabled: boolean) {
    await db.update(channels).set({ enabled }).where(eq(channels.id, id));
  }

  // One user, email target, market alert and event, joined by one delivery row.
  async function newDelivery(
    fields: Partial<DeliveryInsert> = {},
  ): Promise<{ id: string; address: string }> {
    const address = `worker-test-${randomUUID()}@example.com`;
    const [user] = await db
      .insert(users)
      .values({ email: address, passwordHash: 'not used', role: 'user' })
      .returning();
    userIds.push(user.id);
    const [target] = await db
      .insert(targets)
      .values({
        userId: user.id,
        name: 'Inbox',
        channel: 'email',
        config: { address },
      })
      .returning();
    const [alert] = await db
      .insert(alerts)
      .values({
        userId: user.id,
        name: 'Big moves',
        category: 'market',
        filters: { symbols: [], direction: 'any', minChangePct: 5 },
        minSeverity: 1,
        enabled: true,
      })
      .returning();
    await db
      .insert(alertTargets)
      .values({ alertId: alert.id, targetId: target.id });
    const [event] = await db
      .insert(events)
      .values({
        sourceId: SOURCE_ID,
        externalId: randomUUID(),
        category: 'market',
        title: 'TSLA jumps',
        summary: '',
        severity: 3,
        data: { symbol: 'TSLA', price: 182.5, changePct: 7 },
        occurredAt: new Date(),
      })
      .returning();
    const [delivery] = await db
      .insert(deliveries)
      .values({
        alertId: alert.id,
        eventId: event.id,
        targetId: target.id,
        channel: 'email',
        status: 'pending',
        ...fields,
      })
      .returning();
    return { id: delivery.id, address };
  }

  async function load(id: string) {
    const [row] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, id));
    return row;
  }

  function sendsTo(address: string): number {
    return send.mock.calls.filter(
      ([config]) => (config as EmailConfig).address === address,
    ).length;
  }

  it('sends a pending row and marks it sent with attempts 1', async () => {
    const { id, address } = await newDelivery();

    await newWorker().tick();

    expect(await load(id)).toMatchObject({
      status: 'sent',
      attempts: 1,
      lastError: null,
      sentAt: expect.any(Date),
    });
    expect(sendsTo(address)).toBe(1);
    expect(send).toHaveBeenCalledWith(
      { address },
      {
        subject: '[market] TSLA jumps',
        text: expect.stringContaining('Alert: Big moves'),
      },
    );
  });

  it('marks a failed send failed with attempts 1 and the next attempt one base later', async () => {
    send.mockRejectedValue(new Error('SMTP error: ECONNREFUSED'));
    const { id } = await newDelivery();

    const before = Date.now();
    await newWorker().tick();
    const after = Date.now();

    const row = await load(id);
    expect(row).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'SMTP error: ECONNREFUSED',
      sentAt: null,
    });
    const nextAt = row.nextAttemptAt.getTime();
    expect(nextAt).toBeGreaterThanOrEqual(before + BASE_MS - CLOCK_SLACK_MS);
    expect(nextAt).toBeLessThanOrEqual(after + BASE_MS + CLOCK_SLACK_MS);
  });

  it('with max attempts 3 and base 0, three failing ticks end in dead after three sends', async () => {
    send.mockRejectedValue(new Error('Slack responded 500'));
    const { id, address } = await newDelivery();
    const worker = newWorker({
      DELIVERY_MAX_ATTEMPTS: 3,
      DELIVERY_BACKOFF_BASE_MS: 0,
    });

    await worker.tick();
    expect(await load(id)).toMatchObject({ status: 'failed', attempts: 1 });
    await worker.tick();
    expect(await load(id)).toMatchObject({ status: 'failed', attempts: 2 });
    await worker.tick();
    expect(await load(id)).toMatchObject({
      status: 'dead',
      attempts: 3,
      lastError: 'Slack responded 500',
    });
    await worker.tick();

    expect(sendsTo(address)).toBe(3);
  });

  it('marks a sending row with an expired lease and attempts at max dead without sending it', async () => {
    const { id, address } = await newDelivery({
      status: 'sending',
      attempts: 5,
      nextAttemptAt: new Date(Date.now() - 1000),
    });

    await newWorker().tick();

    expect(await load(id)).toMatchObject({
      status: 'dead',
      attempts: 5,
      lastError: 'lease expired',
    });
    expect(sendsTo(address)).toBe(0);
  });

  it('claims and sends a sending row with an expired lease and attempts below max, and leaves a running lease alone', async () => {
    const expired = await newDelivery({
      status: 'sending',
      attempts: 2,
      nextAttemptAt: new Date(Date.now() - 1000),
    });
    const leased = await newDelivery({
      status: 'sending',
      attempts: 2,
      nextAttemptAt: new Date(Date.now() + 60_000),
    });

    await newWorker().tick();

    expect(await load(expired.id)).toMatchObject({
      status: 'sent',
      attempts: 3,
    });
    expect(sendsTo(expired.address)).toBe(1);
    expect(await load(leased.id)).toMatchObject({
      status: 'sending',
      attempts: 2,
    });
    expect(sendsTo(leased.address)).toBe(0);
  });

  // Such a row exists when DELIVERY_MAX_ATTEMPTS is lowered while it waits.
  it('does not claim a failed row whose attempts already reach max', async () => {
    const { id, address } = await newDelivery({
      status: 'failed',
      attempts: 3,
      nextAttemptAt: new Date(Date.now() - 1000),
    });

    await newWorker({ DELIVERY_MAX_ATTEMPTS: 3 }).tick();

    expect(await load(id)).toMatchObject({ status: 'failed', attempts: 3 });
    expect(sendsTo(address)).toBe(0);
  });

  it('drops a stale result when a newer claim owns the row', async () => {
    let finishSend: (() => void) | undefined;
    send.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSend = resolve;
        }),
    );
    const { id } = await newDelivery();

    const tick = newWorker().tick();
    await vi.waitFor(() => expect(finishSend).toBeDefined());
    await db
      .update(deliveries)
      .set({ attempts: 2, nextAttemptAt: new Date(Date.now() + 60_000) })
      .where(eq(deliveries.id, id));
    finishSend?.();
    await tick;

    expect(await load(id)).toMatchObject({
      status: 'sending',
      attempts: 2,
      sentAt: null,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      { deliveryId: id, attempts: 1 },
      'Dropped a stale delivery result',
    );
  });

  it('leaves a row pending while its channel is disabled and sends it once the channel is enabled', async () => {
    await setChannelEnabled('email', false);
    const { id, address } = await newDelivery();
    const worker = newWorker();

    await worker.tick();
    expect(await load(id)).toMatchObject({ status: 'pending', attempts: 0 });
    expect(sendsTo(address)).toBe(0);

    await setChannelEnabled('email', true);
    await worker.tick();
    expect(await load(id)).toMatchObject({ status: 'sent', attempts: 1 });
    expect(sendsTo(address)).toBe(1);
  });

  it('sends a pending row once when two workers tick at the same time', async () => {
    const { id, address } = await newDelivery();

    await Promise.all([newWorker().tick(), newWorker().tick()]);

    expect(sendsTo(address)).toBe(1);
    expect(await load(id)).toMatchObject({ status: 'sent', attempts: 1 });
  });
});
