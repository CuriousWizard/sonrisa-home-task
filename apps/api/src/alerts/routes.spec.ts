import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../app';
import { SESSION_COOKIE } from '../auth/session';
import { createChannelRegistry } from '../channels/registry';
import { loadConfig } from '../config';
import { createDb, type Db } from '../db/client';
import { alerts, alertTargets, targets, users } from '../db/schema';

describe('alert routes', () => {
  let app: FastifyInstance;
  let db: Db;
  let pool: Pool;
  let userIds: string[] = [];

  beforeAll(async () => {
    const config = loadConfig(process.env);
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    app = await buildApp(config, {
      db,
      channels: createChannelRegistry(config),
    });
    await app.ready();
  });

  afterEach(async () => {
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
        email: `alerts-test-${randomUUID()}@example.com`,
        passwordHash: 'not used',
        role: 'user',
      })
      .returning();
    userIds.push(user.id);
    return { id: user.id, session: await app.sessions.sign(user) };
  }

  async function newTarget(userId: string): Promise<string> {
    const [target] = await db
      .insert(targets)
      .values({
        userId,
        name: 'Inbox',
        channel: 'email',
        config: { address: 'someone@example.com' },
      })
      .returning();
    return target.id;
  }

  function call(
    session: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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

  function newsAlert(targetIds: string[]) {
    return {
      name: 'Oil news',
      category: 'news',
      minSeverity: 2,
      enabled: true,
      targetIds,
      filters: { keywords: ['oil'] },
    };
  }

  function marketAlert(targetIds: string[]) {
    return {
      name: 'Tesla drops',
      category: 'market',
      minSeverity: 3,
      enabled: true,
      targetIds,
      filters: { symbols: ['TSLA'], direction: 'down', minChangePct: 5 },
    };
  }

  function disasterAlert(targetIds: string[]) {
    return {
      name: 'Big quakes',
      category: 'disaster',
      minSeverity: 1,
      enabled: false,
      targetIds,
      filters: { types: ['earthquake'], regions: ['asia'], minMagnitude: 6 },
    };
  }

  async function createAlert(session: string, body: object): Promise<string> {
    const response = await call(session, 'POST', '/api/alerts', body);
    expect(response.statusCode).toBe(201);
    return response.json().id;
  }

  async function storedTargetIds(alertId: string): Promise<string[]> {
    const rows = await db
      .select()
      .from(alertTargets)
      .where(eq(alertTargets.alertId, alertId));
    return rows.map((row) => row.targetId).sort();
  }

  it('creates one alert per category and lists them with their target ids', async () => {
    const { id, session } = await newUser();
    const targetId = await newTarget(id);
    const bodies = [
      newsAlert([targetId]),
      marketAlert([targetId]),
      disasterAlert([targetId]),
    ];

    const created = [];
    for (const body of bodies) {
      const response = await call(session, 'POST', '/api/alerts', body);
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        ...body,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      created.push(response.json());
    }

    const list = await call(session, 'GET', '/api/alerts');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(3);
    expect(list.json()).toEqual(expect.arrayContaining(created));
  });

  it('rejects filters of another category with 400', async () => {
    const { id, session } = await newUser();
    const targetId = await newTarget(id);

    const response = await call(session, 'POST', '/api/alerts', {
      ...newsAlert([targetId]),
      filters: marketAlert([]).filters,
    });
    expect(response.statusCode).toBe(400);
    const rows = await db.select().from(alerts).where(eq(alerts.userId, id));
    expect(rows).toEqual([]);
  });

  it('rejects a targetId that belongs to another user with 400', async () => {
    const owner = await newUser();
    const other = await newUser();
    const ownTarget = await newTarget(owner.id);
    const otherTarget = await newTarget(other.id);

    const response = await call(
      owner.session,
      'POST',
      '/api/alerts',
      newsAlert([ownTarget, otherTarget]),
    );
    expect(response.statusCode).toBe(400);
    const rows = await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, owner.id));
    expect(rows).toEqual([]);
  });

  it("returns 404 for another user's alert and for an unknown id", async () => {
    const owner = await newUser();
    const other = await newUser();
    const otherTarget = await newTarget(other.id);
    const alertId = await createAlert(
      owner.session,
      newsAlert([await newTarget(owner.id)]),
    );
    const url = `/api/alerts/${alertId}`;

    expect((await call(other.session, 'GET', url)).statusCode).toBe(404);
    expect(
      (await call(other.session, 'PUT', url, newsAlert([otherTarget])))
        .statusCode,
    ).toBe(404);
    expect(
      (await call(other.session, 'PATCH', url, { enabled: false })).statusCode,
    ).toBe(404);
    expect((await call(other.session, 'DELETE', url)).statusCode).toBe(404);
    expect(
      (await call(owner.session, 'GET', `/api/alerts/${randomUUID()}`))
        .statusCode,
    ).toBe(404);

    const owned = await call(owner.session, 'GET', url);
    expect(owned.statusCode).toBe(200);
    expect(owned.json()).toMatchObject({ name: 'Oil news', enabled: true });
  });

  it('rejects a PUT without enabled with 400', async () => {
    const { id, session } = await newUser();
    const targetId = await newTarget(id);
    const alertId = await createAlert(session, newsAlert([targetId]));

    const withoutEnabled: Record<string, unknown> = {
      ...newsAlert([targetId]),
      name: 'Renamed',
    };
    delete withoutEnabled.enabled;
    const response = await call(
      session,
      'PUT',
      `/api/alerts/${alertId}`,
      withoutEnabled,
    );
    expect(response.statusCode).toBe(400);
    const [row] = await db.select().from(alerts).where(eq(alerts.id, alertId));
    expect(row.name).toBe('Oil news');
  });

  it('PATCH { enabled: false } turns the alert off', async () => {
    const { id, session } = await newUser();
    const targetId = await newTarget(id);
    const alertId = await createAlert(session, newsAlert([targetId]));
    const url = `/api/alerts/${alertId}`;

    const patched = await call(session, 'PATCH', url, { enabled: false });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      enabled: false,
      targetIds: [targetId],
    });

    const fetched = await call(session, 'GET', url);
    expect(fetched.json()).toMatchObject({ enabled: false });
  });

  it('PUT replaces every field and the target set', async () => {
    const { id, session } = await newUser();
    const [first, second, third] = [
      await newTarget(id),
      await newTarget(id),
      await newTarget(id),
    ];
    const alertId = await createAlert(session, newsAlert([first, second]));
    const url = `/api/alerts/${alertId}`;

    const replacement = marketAlert([second, third]);
    const updated = await call(session, 'PUT', url, replacement);
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ ...replacement, id: alertId });

    const fetched = (await call(session, 'GET', url)).json();
    expect(fetched).toMatchObject({
      ...replacement,
      targetIds: expect.arrayContaining([second, third]),
    });
    expect(fetched.targetIds).toHaveLength(2);
    expect(await storedTargetIds(alertId)).toEqual([second, third].sort());
  });

  it('DELETE returns 204 and a later GET returns 404', async () => {
    const { id, session } = await newUser();
    const targetId = await newTarget(id);
    const alertId = await createAlert(session, newsAlert([targetId]));
    const url = `/api/alerts/${alertId}`;

    expect((await call(session, 'DELETE', url)).statusCode).toBe(204);
    expect((await call(session, 'GET', url)).statusCode).toBe(404);
    expect(await storedTargetIds(alertId)).toEqual([]);
  });
});
