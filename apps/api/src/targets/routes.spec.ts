import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { ChannelId, EmailConfig } from '@alerts/shared';
import { buildApp } from '../app';
import { SESSION_COOKIE } from '../auth/session';
import type { NotificationMessage } from '../channels/channel';
import type { ChannelRegistry } from '../channels/registry';
import { createSlackChannel } from '../channels/slack';
import { loadConfig } from '../config';
import { createDb, type Db } from '../db/client';
import { syncRegistryRows } from '../db/registry-sync';
import { alerts, alertTargets, channels, targets, users } from '../db/schema';
import { buildTestMessage } from '../delivery/message';

describe('target routes', () => {
  let app: FastifyInstance;
  let db: Db;
  let pool: Pool;
  let userIds: string[] = [];
  const emailSends = vi.fn<
    (config: EmailConfig, message: NotificationMessage) => Promise<void>
  >(async () => undefined);

  beforeAll(async () => {
    const config = loadConfig(process.env);
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    const fakeChannels: ChannelRegistry = {
      email: { id: 'email', configSchema: EmailConfig, send: emailSends },
      slack: createSlackChannel(['https://hooks.slack.com/services/']),
    };
    app = await buildApp(config, { db, channels: fakeChannels });
    await app.ready();
    await syncRegistryRows(db, { channelIds: ChannelId.options, sources: [] });
  });

  afterEach(async () => {
    emailSends.mockClear();
    // Deleting the users cascades to their targets, alerts and alert_targets rows.
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
    userIds = [];
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  async function newUser(): Promise<{ id: string; session: string }> {
    const [user] = await db
      .insert(users)
      .values({
        email: `targets-test-${randomUUID()}@example.com`,
        passwordHash: 'not used',
        role: 'user',
      })
      .returning();
    userIds.push(user.id);
    return { id: user.id, session: await app.sessions.sign(user) };
  }

  function call(
    session: string,
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    payload?: object,
  ): Promise<LightMyRequestResponse> {
    return app.inject({
      method,
      url,
      cookies: { [SESSION_COOKIE]: session },
      ...(payload ? { payload } : {}),
    });
  }

  async function createEmailTarget(session: string): Promise<string> {
    const response = await call(session, 'POST', '/api/targets', {
      name: 'Inbox',
      channel: 'email',
      config: { address: 'someone@example.com' },
    });
    expect(response.statusCode).toBe(201);
    return response.json().id;
  }

  it('creates an email target and lists it', async () => {
    const { session } = await newUser();
    const created = await call(session, 'POST', '/api/targets', {
      name: 'Inbox',
      channel: 'email',
      config: { address: 'someone@example.com' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      id: expect.any(String),
      name: 'Inbox',
      channel: 'email',
      config: { address: 'someone@example.com' },
      createdAt: expect.any(String),
    });

    const list = await call(session, 'GET', '/api/targets');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([created.json()]);
  });

  it('rejects a Slack target outside the allowlist with 400', async () => {
    const { id, session } = await newUser();
    const webhookUrl = 'https://hooks.slack.com.evil.com/services/x';
    const response = await call(session, 'POST', '/api/targets', {
      name: 'Evil',
      channel: 'slack',
      config: { webhookUrl },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(webhookUrl);
    const rows = await db.select().from(targets).where(eq(targets.userId, id));
    expect(rows).toEqual([]);
  });

  it("returns 404 when deleting another user's target", async () => {
    const owner = await newUser();
    const other = await newUser();
    const targetId = await createEmailTarget(owner.session);

    const response = await call(
      other.session,
      'DELETE',
      `/api/targets/${targetId}`,
    );
    expect(response.statusCode).toBe(404);
    const rows = await db.select().from(targets).where(eq(targets.id, targetId));
    expect(rows).toHaveLength(1);
  });

  it('returns 409 when an alert still uses the target, and 204 once it does not', async () => {
    const { id, session } = await newUser();
    const targetId = await createEmailTarget(session);
    const [alert] = await db
      .insert(alerts)
      .values({
        userId: id,
        name: 'Uses the target',
        category: 'news',
        filters: { keywords: [] },
        minSeverity: 1,
        enabled: true,
      })
      .returning();
    await db.insert(alertTargets).values({ alertId: alert.id, targetId });

    const blocked = await call(session, 'DELETE', `/api/targets/${targetId}`);
    expect(blocked.statusCode).toBe(409);

    await db.delete(alerts).where(eq(alerts.id, alert.id));
    const deleted = await call(session, 'DELETE', `/api/targets/${targetId}`);
    expect(deleted.statusCode).toBe(204);
  });

  it('the test route returns 409 for a disabled channel and sends otherwise', async () => {
    const { session } = await newUser();
    const targetId = await createEmailTarget(session);

    await db
      .update(channels)
      .set({ enabled: false })
      .where(eq(channels.id, 'email'));
    try {
      const disabled = await call(
        session,
        'POST',
        `/api/targets/${targetId}/test`,
      );
      expect(disabled.statusCode).toBe(409);
      expect(emailSends).not.toHaveBeenCalled();
    } finally {
      await db
        .update(channels)
        .set({ enabled: true })
        .where(eq(channels.id, 'email'));
    }

    const sent = await call(session, 'POST', `/api/targets/${targetId}/test`);
    expect(sent.statusCode).toBe(200);
    expect(sent.json()).toEqual({ ok: true });
    expect(emailSends).toHaveBeenCalledWith(
      { address: 'someone@example.com' },
      buildTestMessage('Inbox'),
    );

    emailSends.mockRejectedValueOnce(new Error('SMTP error: ECONNECTION'));
    const failed = await call(session, 'POST', `/api/targets/${targetId}/test`);
    expect(failed.json()).toEqual({
      ok: false,
      error: 'SMTP error: ECONNECTION',
    });
  });

  it("the test route returns 404 for another user's target", async () => {
    const owner = await newUser();
    const other = await newUser();
    const targetId = await createEmailTarget(owner.session);

    const response = await call(
      other.session,
      'POST',
      `/api/targets/${targetId}/test`,
    );
    expect(response.statusCode).toBe(404);
    expect(emailSends).not.toHaveBeenCalled();
  });
});
