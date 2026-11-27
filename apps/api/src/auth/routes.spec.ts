import { randomBytes, randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { SignJWT } from 'jose';
import type { Pool } from 'pg';
import { buildApp } from '../app';
import { createChannelRegistry } from '../channels/registry';
import { loadConfig, type Config } from '../config';
import { createDb, type Db } from '../db/client';
import { users } from '../db/schema';
import { createSessionTokens, SESSION_COOKIE } from './session';

const password = 'correct horse battery';

describe('auth routes', () => {
  let app: FastifyInstance;
  let config: Config;
  let db: Db;
  let pool: Pool;
  let createdEmails: string[] = [];

  beforeAll(async () => {
    config = loadConfig({ ...process.env, AUTH_RATE_LIMIT_MAX: '1000' });
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    app = await buildApp(config, {
      db,
      channels: createChannelRegistry(config),
    });
    await app.ready();
  });

  afterEach(async () => {
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
    createdEmails = [];
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  function newEmail(): string {
    const email = `auth-test-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return email;
  }

  function register(email: string): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password },
    });
  }

  function login(
    email: string,
    loginPassword: string,
    target: FastifyInstance = app,
  ): Promise<LightMyRequestResponse> {
    return target.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: loginPassword },
    });
  }

  function me(session: string): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { [SESSION_COOKIE]: session },
    });
  }

  function sessionCookie(response: LightMyRequestResponse) {
    const cookie = response.cookies.find(
      (candidate) => candidate.name === SESSION_COOKIE,
    );
    if (!cookie) {
      throw new Error('The response set no session cookie');
    }
    return cookie;
  }

  it('register then me returns 200 with the user', async () => {
    const email = newEmail();
    const registered = await register(email);
    expect(registered.statusCode).toBe(201);

    const response = await me(sessionCookie(registered).value);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: registered.json().id,
      email,
      role: 'user',
    });
  });

  it('a duplicate register returns 409', async () => {
    const email = newEmail();
    expect((await register(email)).statusCode).toBe(201);

    const duplicate = await register(email);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.cookies).toEqual([]);
  });

  it('login with a wrong password returns 401', async () => {
    const email = newEmail();
    expect((await register(email)).statusCode).toBe(201);

    const wrong = await login(email, 'wrong horse battery');
    expect(wrong.statusCode).toBe(401);
    expect(wrong.cookies).toEqual([]);
    expect((await login(email, password)).statusCode).toBe(200);
  });

  it('register and login set an HttpOnly, SameSite=Strict session cookie on Path=/', async () => {
    const email = newEmail();
    const registered = await register(email);
    expect(registered.statusCode).toBe(201);
    const loggedIn = await login(email, password);
    expect(loggedIn.statusCode).toBe(200);

    for (const response of [registered, loggedIn]) {
      expect(sessionCookie(response)).toMatchObject({
        httpOnly: true,
        sameSite: 'Strict',
        path: '/',
      });
    }
  });

  it('the third login in a minute returns 429 when AUTH_RATE_LIMIT_MAX is 2', async () => {
    const email = newEmail();
    expect((await register(email)).statusCode).toBe(201);
    const limited = await buildApp(
      loadConfig({ ...process.env, AUTH_RATE_LIMIT_MAX: '2' }),
      { db, channels: createChannelRegistry(config) },
    );
    try {
      expect((await login(email, password, limited)).statusCode).toBe(200);
      expect((await login(email, password, limited)).statusCode).toBe(200);
      const third = await login(email, password, limited);
      expect(third.statusCode).toBe(429);
      expect(third.cookies).toEqual([]);
    } finally {
      await limited.close();
    }
  });

  it('logout clears the session cookie', async () => {
    const email = newEmail();
    const session = sessionCookie(await register(email)).value;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(logout.statusCode).toBe(204);
    const cleared = sessionCookie(logout);
    expect(cleared.value).toBe('');
    expect(cleared.path).toBe('/');
    expect(cleared.expires?.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('a session cookie signed with another secret returns 401', async () => {
    const email = newEmail();
    const registered = await register(email);
    expect(registered.statusCode).toBe(201);

    const otherTokens = createSessionTokens(
      randomBytes(36).toString('base64url'),
    );
    const forged = await otherTokens.sign({
      id: registered.json().id,
      role: 'user',
    });
    expect((await me(forged)).statusCode).toBe(401);
  });

  it('a session token signed with the right secret but without exp returns 401', async () => {
    const email = newEmail();
    const registered = await register(email);
    expect(registered.statusCode).toBe(201);

    const sign = (withExpiry: boolean) => {
      const jwt = new SignJWT({ role: 'user' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(registered.json().id)
        .setIssuedAt();
      if (withExpiry) {
        jwt.setExpirationTime('1h');
      }
      return jwt.sign(new TextEncoder().encode(config.JWT_SECRET));
    };
    // The same token with exp passes, so the 401 comes from the missing claim.
    expect((await me(await sign(true))).statusCode).toBe(200);
    expect((await me(await sign(false))).statusCode).toBe(401);
  });

  it('a user whose row was deleted returns 401', async () => {
    const email = newEmail();
    const session = sessionCookie(await register(email)).value;
    expect((await me(session)).statusCode).toBe(200);

    await db.delete(users).where(eq(users.email, email));
    expect((await me(session)).statusCode).toBe(401);
  });

  it('a request with Content-Type text/plain returns 415', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'text/plain' },
      payload: JSON.stringify({ email: 'nobody@example.com', password }),
    });
    expect(response.statusCode).toBe(415);
  });
});
