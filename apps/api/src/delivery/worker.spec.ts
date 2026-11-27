import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
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

interface HeldSend {
  address: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

async function finishesWithin(
  promise: Promise<unknown>,
  ms: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([promise.then(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

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
        DELIVERY_SEND_TIMEOUT_MS: 20_000,
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

  // Every send waits until the test settles it.
  function holdSends(): HeldSend[] {
    const held: HeldSend[] = [];
    send.mockImplementation(
      (config) =>
        new Promise<void>((resolve, reject) => {
          held.push({ address: (config as EmailConfig).address, resolve, reject });
        }),
    );
    return held;
  }

  // Mirrors POST /api/admin/deliveries/:id/retry.
  async function retryAsAdmin(id: string) {
    await db
      .update(deliveries)
      .set({
        status: 'pending',
        attempts: 0,
        nextAttemptAt: sql`now()`,
        lastError: null,
        claimToken: null,
      })
      .where(eq(deliveries.id, id));
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

  it('drops the result of a send whose row was reclaimed, retried by an admin and claimed again with the same attempt count', async () => {
    const held = holdSends();
    const { id } = await newDelivery();

    // Worker A's lease ends while its send is still running.
    const tickA = newWorker({ DELIVERY_LEASE_MS: 1 }).tick();
    await vi.waitFor(() => expect(held).toHaveLength(1));
    const claimA = await load(id);
    expect(claimA).toMatchObject({ status: 'sending', attempts: 1 });

    const tickB = newWorker().tick();
    await vi.waitFor(() => expect(held).toHaveLength(2));
    held[1].reject(new Error('Slack responded 500'));
    await tickB;
    expect(await load(id)).toMatchObject({ status: 'failed', attempts: 2 });

    await retryAsAdmin(id);

    const tickC = newWorker().tick();
    await vi.waitFor(() => expect(held).toHaveLength(3));
    const claimC = await load(id);
    expect(claimC).toMatchObject({ status: 'sending', attempts: 1 });
    expect(claimC.claimToken).not.toBe(claimA.claimToken);

    held[0].resolve();
    await tickA;

    expect(await load(id)).toMatchObject({
      status: 'sending',
      attempts: 1,
      claimToken: claimC.claimToken,
      sentAt: null,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      { deliveryId: id, attempts: 1 },
      'Dropped a stale delivery result',
    );

    held[2].resolve();
    await tickC;
    expect(await load(id)).toMatchObject({ status: 'sent', attempts: 1 });
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

  it('does not send a row twice when two workers tick at the same time, because the claim locks the row', async () => {
    const { id, address } = await newDelivery();

    await Promise.all([newWorker().tick(), newWorker().tick()]);

    expect(sendsTo(address)).toBe(1);
    expect(await load(id)).toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('skips a row locked by another transaction and sends the next row without waiting', async () => {
    const locked = await newDelivery();
    const free = await newDelivery();
    const client = await pool.connect();
    let tick: Promise<void> | undefined;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM deliveries WHERE id = $1 FOR UPDATE', [
        locked.id,
      ]);

      tick = newWorker().tick();

      expect(await finishesWithin(tick, 1000)).toBe(true);
      expect(sendsTo(free.address)).toBe(1);
      expect(sendsTo(locked.address)).toBe(0);
      expect(await load(locked.id)).toMatchObject({
        status: 'pending',
        attempts: 0,
      });
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await tick;
    }
  });

  it('writes the result of a finished send while another send in the batch is still running', async () => {
    const slow = await newDelivery();
    const fast = await newDelivery();
    let finishSlow: (() => void) | undefined;
    send.mockImplementation((config) =>
      (config as EmailConfig).address === slow.address
        ? new Promise<void>((resolve) => {
            finishSlow = resolve;
          })
        : Promise.resolve(),
    );

    const tick = newWorker().tick();

    await vi.waitFor(async () =>
      expect(await load(fast.id)).toMatchObject({ status: 'sent' }),
    );
    expect(finishSlow).toBeDefined();
    expect(await load(slow.id)).toMatchObject({ status: 'sending' });

    finishSlow?.();
    await tick;
    expect(await load(slow.id)).toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('marks a send that outlasts DELIVERY_SEND_TIMEOUT_MS failed with "send timed out"', async () => {
    send.mockImplementation(() => new Promise<void>(() => undefined));
    const { id } = await newDelivery();

    await newWorker({ DELIVERY_SEND_TIMEOUT_MS: 50 }).tick();

    expect(await load(id)).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'send timed out',
      sentAt: null,
    });
  });
});
