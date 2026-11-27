import { randomBytes } from 'node:crypto';
import { createServer, type AddressInfo } from 'node:net';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import {
  ChannelId,
  type AlertDto,
  type ChannelDto,
  type DeliveryDto,
  type DevEventResult,
  type TargetDto,
  type UserDto,
} from '@alerts/shared';
import { buildApp } from './app';
import { hashPassword } from './auth/password';
import { SESSION_COOKIE } from './auth/session';
import { createChannelRegistry } from './channels/registry';
import { loadConfig } from './config';
import { createDb, type Db } from './db/client';
import { syncRegistryRows } from './db/registry-sync';
import { deliveries, events, users } from './db/schema';
import { createWorker, type DeliveryWorker } from './delivery/worker';

const MAILPIT_API = 'http://127.0.0.1:8025/api/v1';
const PASSWORD = 'pipeline-password-123';

type DeliveryRow = typeof deliveries.$inferSelect;

interface RequestOptions {
  session?: string;
  body?: object;
}

interface Subscriber {
  session: string;
  email: string;
  hookId: string;
  alertId: string;
  alertName: string;
}

interface MockSlackEntry {
  hookId: string;
  text: string;
}

// Hex only, so the value is safe in emails, hook ids and Mailpit queries.
function suffix(): string {
  return randomBytes(6).toString('hex');
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function sessionFrom(response: Response): string {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const separator = pair.indexOf('=');
    if (pair.slice(0, separator) === SESSION_COOKIE) {
      return pair.slice(separator + 1);
    }
  }
  throw new Error('The response set no session cookie');
}

async function mailTo(address: string): Promise<{ Subject: string }[]> {
  const query = new URLSearchParams({ query: `to:${address}` });
  const response = await fetch(`${MAILPIT_API}/search?${query}`);
  expect(response.status).toBe(200);
  const { messages } = (await response.json()) as {
    messages: { Subject: string }[];
  };
  return messages;
}

// Runs every step even when an earlier one fails, then reports all failures.
async function runEach(steps: (() => Promise<unknown>)[]): Promise<void> {
  const errors: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Teardown failed');
  }
}

describe('event pipeline over HTTP', () => {
  let app: FastifyInstance;
  let db: Db;
  let pool: Pool;
  let worker: DeliveryWorker;
  let baseUrl: string;
  let mockSlackPrefix: string;
  let adminId: string | undefined;
  let adminSession: string;
  let userIds: string[] = [];
  let eventIds: string[] = [];

  beforeAll(async () => {
    // The channel registry needs the allowlist prefix, with the port, before the app can listen.
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    mockSlackPrefix = `${baseUrl}/api/dev/mock-slack/`;
    const loaded = loadConfig({
      ...process.env,
      SLACK_WEBHOOK_ALLOWED_PREFIXES: mockSlackPrefix,
      DELIVERY_MAX_ATTEMPTS: '3',
      AUTH_RATE_LIMIT_MAX: '1000',
    });
    // loadConfig rejects a base of 0, so it is set after parsing.
    const config = { ...loaded, DELIVERY_BACKOFF_BASE_MS: 0 };
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    await syncRegistryRows(db, { channelIds: ChannelId.options, sources: [] });
    const channels = createChannelRegistry(config);
    app = await buildApp(config, { db, channels });
    await app.listen({ port, host: '127.0.0.1' });
    worker = createWorker({ db, channels, config, logger: app.log });

    const adminEmail = `pipeline-admin-${suffix()}@example.com`;
    const [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash: await hashPassword(PASSWORD),
        role: 'admin',
      })
      .returning();
    adminId = admin.id;
    const login = await call('POST', '/api/auth/login', {
      body: { email: adminEmail, password: PASSWORD },
    });
    expect(login.status).toBe(200);
    adminSession = sessionFrom(login);
    // An earlier run that stopped mid-test can leave a channel off.
    for (const id of ChannelId.options) {
      await setChannelEnabled(id, true);
    }
  });

  afterEach(async () => {
    await runEach([
      () => setMockSlackFails(false),
      // Deleting the users cascades to their targets, alerts and deliveries.
      async () => {
        if (userIds.length > 0) {
          await db.delete(users).where(inArray(users.id, userIds));
        }
        userIds = [];
      },
      async () => {
        if (eventIds.length > 0) {
          await db.delete(events).where(inArray(events.id, eventIds));
        }
        eventIds = [];
      },
    ]);
  });

  afterAll(async () => {
    await runEach([
      async () => {
        if (adminId) {
          await db.delete(users).where(eq(users.id, adminId));
        }
      },
      async () => app?.close(),
      async () => pool?.end(),
    ]);
  });

  function call(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<Response> {
    const headers = new Headers();
    if (options.session) {
      headers.set('cookie', `${SESSION_COOKIE}=${options.session}`);
    }
    // Fastify rejects an empty body sent as application/json.
    if (options.body) {
      headers.set('content-type', 'application/json');
    }
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  async function expectJson<T>(
    status: number,
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await call(method, path, options);
    const text = await response.text();
    expect(response.status, `${method} ${path} answered ${text}`).toBe(status);
    return JSON.parse(text) as T;
  }

  async function setMockSlackFails(fail: boolean): Promise<void> {
    await expectJson(200, 'PUT', '/api/dev/mock-slack/mode', {
      body: { fail },
    });
  }

  async function setChannelEnabled(
    id: ChannelId,
    enabled: boolean,
  ): Promise<void> {
    const channel = await expectJson<ChannelDto>(
      200,
      'PATCH',
      `/api/admin/channels/${id}`,
      { session: adminSession, body: { enabled } },
    );
    expect(channel).toMatchObject({ id, enabled });
  }

  // A registered user with an email target, a mock Slack target and a market alert on both.
  async function newSubscriber(): Promise<Subscriber> {
    const id = suffix();
    const email = `pipeline-${id}@example.com`;
    const register = await call('POST', '/api/auth/register', {
      body: { email, password: PASSWORD },
    });
    expect(register.status).toBe(201);
    const user = (await register.json()) as UserDto;
    userIds.push(user.id);
    const session = sessionFrom(register);

    const hookId = `pipeline-${id}`;
    const emailTarget = await expectJson<TargetDto>(
      201,
      'POST',
      '/api/targets',
      {
        session,
        body: {
          name: `Inbox ${id}`,
          channel: 'email',
          config: { address: email },
        },
      },
    );
    const slackTarget = await expectJson<TargetDto>(
      201,
      'POST',
      '/api/targets',
      {
        session,
        body: {
          name: `Team ${id}`,
          channel: 'slack',
          config: { webhookUrl: `${mockSlackPrefix}${hookId}` },
        },
      },
    );
    const alertName = `Big moves ${id}`;
    const alert = await expectJson<AlertDto>(201, 'POST', '/api/alerts', {
      session,
      body: {
        name: alertName,
        category: 'market',
        filters: { symbols: [], direction: 'any', minChangePct: 5 },
        minSeverity: 1,
        targetIds: [emailTarget.id, slackTarget.id],
        enabled: true,
      },
    });
    return { session, email, hookId, alertId: alert.id, alertName };
  }

  async function injectMarketEvent(changePct: number): Promise<DevEventResult> {
    const result = await expectJson<DevEventResult>(
      201,
      'POST',
      '/api/dev/events',
      {
        body: {
          category: 'market',
          title: `PIPE moves ${suffix()}`,
          severity: 3,
          data: { symbol: 'PIPE', price: 100, changePct },
        },
      },
    );
    eventIds.push(result.event.id);
    return result;
  }

  async function deliveriesOf(
    alertId: string,
  ): Promise<Partial<Record<ChannelId, DeliveryRow>>> {
    const rows = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.alertId, alertId));
    return Object.fromEntries(rows.map((row) => [row.channel, row]));
  }

  async function slackMessagesFor(hookId: string): Promise<MockSlackEntry[]> {
    const messages = await expectJson<MockSlackEntry[]>(
      200,
      'GET',
      '/api/dev/mock-slack/messages',
    );
    return messages.filter((message) => message.hookId === hookId);
  }

  it('delivers a matching market event to Mailpit and the mock Slack receiver', async () => {
    const subscriber = await newSubscriber();

    const { event, deliveriesCreated } = await injectMarketEvent(7);
    expect(deliveriesCreated).toBe(2);

    await worker.tick();

    const rows = await deliveriesOf(subscriber.alertId);
    expect(rows.email).toMatchObject({ status: 'sent', attempts: 1 });
    expect(rows.slack).toMatchObject({ status: 'sent', attempts: 1 });
    await vi.waitFor(
      async () => {
        const mail = await mailTo(subscriber.email);
        expect(mail).toHaveLength(1);
        expect(mail[0].Subject).toBe(`[market] ${event.title}`);
      },
      { timeout: 5_000 },
    );
    const slack = await slackMessagesFor(subscriber.hookId);
    expect(slack).toHaveLength(1);
    expect(slack[0].text).toContain(event.title);
    expect(slack[0].text).toContain(subscriber.alertName);
  }, 15_000);

  it('creates no delivery for a market event below the alert threshold', async () => {
    const subscriber = await newSubscriber();

    const { deliveriesCreated } = await injectMarketEvent(2);

    expect(deliveriesCreated).toBe(0);
    expect(await deliveriesOf(subscriber.alertId)).toEqual({});
  });

  it('marks a failing Slack delivery dead after three ticks, and an admin retry sends it', async () => {
    const subscriber = await newSubscriber();
    await setMockSlackFails(true);

    const { deliveriesCreated } = await injectMarketEvent(7);
    expect(deliveriesCreated).toBe(2);

    await worker.tick();
    let rows = await deliveriesOf(subscriber.alertId);
    expect(rows.email).toMatchObject({ status: 'sent', attempts: 1 });
    expect(rows.slack).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'Slack responded 500',
    });

    await worker.tick();
    expect((await deliveriesOf(subscriber.alertId)).slack).toMatchObject({
      status: 'failed',
      attempts: 2,
    });

    await worker.tick();
    rows = await deliveriesOf(subscriber.alertId);
    expect(rows.slack).toMatchObject({
      status: 'dead',
      attempts: 3,
      lastError: 'Slack responded 500',
    });
    expect(rows.email).toMatchObject({ status: 'sent', attempts: 1 });

    const slackId = rows.slack?.id;
    const retried = await expectJson<DeliveryDto>(
      200,
      'POST',
      `/api/admin/deliveries/${slackId}/retry`,
      { session: adminSession },
    );
    expect(retried).toMatchObject({
      id: slackId,
      status: 'pending',
      attempts: 0,
      lastError: null,
    });
    await setMockSlackFails(false);

    await worker.tick();

    expect((await deliveriesOf(subscriber.alertId)).slack).toMatchObject({
      status: 'sent',
      attempts: 1,
      lastError: null,
    });
    // Three failed posts and the one that succeeded.
    expect(await slackMessagesFor(subscriber.hookId)).toHaveLength(4);
  });

  it('creates a skipped Slack row and a pending email row while the Slack channel is off', async () => {
    const subscriber = await newSubscriber();
    try {
      await setChannelEnabled('slack', false);
      const { deliveriesCreated } = await injectMarketEvent(7);
      expect(deliveriesCreated).toBe(2);

      const rows = await deliveriesOf(subscriber.alertId);
      expect(rows.slack).toMatchObject({
        status: 'skipped',
        attempts: 0,
        lastError: 'channel disabled',
      });
      expect(rows.email).toMatchObject({ status: 'pending', attempts: 0 });
    } finally {
      await setChannelEnabled('slack', true);
    }
  });
});
