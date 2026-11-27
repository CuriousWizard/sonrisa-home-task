import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { Pool } from 'pg';
import { ChannelId, type AlertInput, type Category } from '@alerts/shared';
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
import type { NewEvent } from '../sources/source';
import { ingestEvent, matchEvent } from './ingest';

const SOURCE_ID = 'ingest-test';

describe('ingestEvent', () => {
  let db: Db;
  let pool: Pool;
  let userIds: string[] = [];

  beforeAll(async () => {
    const config = loadConfig(process.env);
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    await syncRegistryRows(db, { channelIds: ChannelId.options, sources: [] });
  });

  afterEach(async () => {
    // Deleting the users and events cascades to targets, alerts and deliveries.
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
    userIds = [];
    await db.delete(events).where(eq(events.sourceId, SOURCE_ID));
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function newUserWithTargets(): Promise<{
    userId: string;
    emailTargetId: string;
    slackTargetId: string;
  }> {
    const [user] = await db
      .insert(users)
      .values({
        email: `ingest-test-${randomUUID()}@example.com`,
        passwordHash: 'not used',
        role: 'user',
      })
      .returning();
    userIds.push(user.id);
    const [emailTarget, slackTarget] = await db
      .insert(targets)
      .values([
        {
          userId: user.id,
          name: 'Inbox',
          channel: 'email',
          config: { address: 'someone@example.com' },
        },
        {
          userId: user.id,
          name: 'Team channel',
          channel: 'slack',
          config: { webhookUrl: 'https://hooks.slack.com/services/T/B/x' },
        },
      ])
      .returning();
    return {
      userId: user.id,
      emailTargetId: emailTarget.id,
      slackTargetId: slackTarget.id,
    };
  }

  async function newAlert(
    userId: string,
    targetIds: string[],
    fields: Partial<{
      category: Category;
      filters: AlertInput['filters'];
      minSeverity: number;
      enabled: boolean;
    }> = {},
  ): Promise<string> {
    const [alert] = await db
      .insert(alerts)
      .values({
        userId,
        name: 'Oil news',
        category: 'news',
        filters: { keywords: ['oil'] },
        minSeverity: 2,
        enabled: true,
        ...fields,
      })
      .returning();
    await db
      .insert(alertTargets)
      .values(targetIds.map((targetId) => ({ alertId: alert.id, targetId })));
    return alert.id;
  }

  function oilNews(overrides: Partial<NewEvent> = {}): NewEvent {
    return {
      sourceId: SOURCE_ID,
      externalId: randomUUID(),
      category: 'news',
      title: 'Oil prices climb as supply talks stall',
      summary: '',
      severity: 3,
      data: {},
      ...overrides,
    } as NewEvent;
  }

  async function deliveriesFor(alertIds: string[]) {
    return db
      .select()
      .from(deliveries)
      .where(inArray(deliveries.alertId, alertIds));
  }

  async function deliveryCountForEvent(eventId: string): Promise<number> {
    const rows = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.eventId, eventId));
    return rows.length;
  }

  async function setChannelEnabled(id: ChannelId, enabled: boolean) {
    await db.update(channels).set({ enabled }).where(eq(channels.id, id));
  }

  it('a matching alert with an email and a Slack target creates two pending rows', async () => {
    const { userId, emailTargetId, slackTargetId } = await newUserWithTargets();
    const alertId = await newAlert(userId, [emailTargetId, slackTargetId]);

    const result = await ingestEvent(db, oilNews());
    if (!result) {
      throw new Error('ingestEvent returned null for a new event');
    }
    expect(result.event).toMatchObject({
      sourceId: SOURCE_ID,
      category: 'news',
      severity: 3,
    });
    expect(result.deliveriesCreated).toBe(
      await deliveryCountForEvent(result.event.id),
    );

    const rows = await deliveriesFor([alertId]);
    expect(rows).toHaveLength(2);
    expect(
      rows.map(({ targetId, channel }) => ({ targetId, channel })),
    ).toEqual(
      expect.arrayContaining([
        { targetId: emailTargetId, channel: 'email' },
        { targetId: slackTargetId, channel: 'slack' },
      ]),
    );
    for (const row of rows) {
      expect(row).toMatchObject({
        eventId: result.event.id,
        status: 'pending',
        attempts: 0,
        lastError: null,
      });
    }
  });

  it('a disabled channel creates a skipped row with attempts 0', async () => {
    const { userId, emailTargetId, slackTargetId } = await newUserWithTargets();
    const alertId = await newAlert(userId, [emailTargetId, slackTargetId]);

    await setChannelEnabled('slack', false);
    try {
      await ingestEvent(db, oilNews());
    } finally {
      await setChannelEnabled('slack', true);
    }

    const rows = await deliveriesFor([alertId]);
    const byChannel = Object.fromEntries(rows.map((row) => [row.channel, row]));
    expect(byChannel['slack']).toMatchObject({
      status: 'skipped',
      attempts: 0,
      lastError: 'channel disabled',
    });
    expect(byChannel['email']).toMatchObject({
      status: 'pending',
      lastError: null,
    });
  });

  it('creates no rows for an alert below the event severity, in another category, with other keywords or disabled', async () => {
    const { userId, emailTargetId } = await newUserWithTargets();
    const alertIds = [
      await newAlert(userId, [emailTargetId], { minSeverity: 4 }),
      await newAlert(userId, [emailTargetId], {
        category: 'market',
        filters: { symbols: [], direction: 'any', minChangePct: 0 },
        minSeverity: 1,
      }),
      await newAlert(userId, [emailTargetId], {
        filters: { keywords: ['boil'] },
      }),
      await newAlert(userId, [emailTargetId], { enabled: false }),
    ];

    const result = await ingestEvent(db, oilNews({ severity: 3 }));
    expect(result).not.toBeNull();
    expect(await deliveriesFor(alertIds)).toEqual([]);
  });

  it('running matchEvent again for the same event creates no new rows', async () => {
    const { userId, emailTargetId, slackTargetId } = await newUserWithTargets();
    const alertId = await newAlert(userId, [emailTargetId, slackTargetId]);
    const result = await ingestEvent(db, oilNews());
    if (!result) {
      throw new Error('ingestEvent returned null for a new event');
    }
    expect(await deliveriesFor([alertId])).toHaveLength(2);

    const again = await db.transaction((tx) => matchEvent(tx, result.event));
    expect(again).toBe(0);
    expect(await deliveriesFor([alertId])).toHaveLength(2);
  });

  it('returns null when the same sourceId and externalId arrive twice', async () => {
    const { userId, emailTargetId } = await newUserWithTargets();
    const alertId = await newAlert(userId, [emailTargetId]);
    const event = oilNews();

    expect(await ingestEvent(db, event)).not.toBeNull();
    expect(await ingestEvent(db, { ...event, title: 'Changed' })).toBeNull();

    const stored = await db
      .select()
      .from(events)
      .where(eq(events.externalId, event.externalId));
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe(event.title);
    expect(await deliveriesFor([alertId])).toHaveLength(1);
  });
});
