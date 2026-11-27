// Fills the dev stack with demo data and saves the README screenshots in docs/screenshots/.
// Start the stack first, with a short backoff so a failing delivery is dead in under a minute:
//   DELIVERY_BACKOFF_BASE_MS=2000 npm run dev
// Then, in a second shell: npm run screenshots
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'docs', 'screenshots');
const baseURL = 'http://localhost:4200';
const viewport = { width: 1440, height: 900 };
const pollMs = 250;
const waitTimeoutMs = 30_000;
const deadTimeoutMs = 120_000;

const admin = { email: 'admin@example.local', password: 'admin-password-123' };
const account = {
  email: 'screenshots@example.local',
  password: 'screenshots-password-123',
};

const eventS = {
  category: 'disaster',
  title: 'M6.8 earthquake off the coast of Hokkaido, Japan',
  summary:
    'The quake struck at a depth of 35 km. A tsunami advisory is in effect for the Pacific coast.',
  severity: 3,
  data: { type: 'earthquake', region: 'asia', magnitude: 6.8 },
};
const eventA = {
  category: 'market',
  title: 'NVDA falls 7.4% after new chip export limits',
  summary: 'Shares fell in early trading after the announcement.',
  severity: 3,
  data: { symbol: 'NVDA', price: 162.35, changePct: -7.4 },
};
const eventB = {
  category: 'market',
  title: 'AAPL rises 6.2% on record services revenue',
  summary: 'The quarterly report beat analyst estimates.',
  severity: 3,
  data: { symbol: 'AAPL', price: 251.8, changePct: 6.2 },
};
const eventC = {
  category: 'disaster',
  title: 'M6.3 earthquake strikes eastern Taiwan',
  summary: 'Rail services are paused while engineers inspect the lines.',
  severity: 3,
  data: { type: 'earthquake', region: 'asia', magnitude: 6.3 },
};

function fail(message) {
  console.error(`\nscreenshots failed: ${message}`);
  process.exit(1);
}

function secondsSince(startedAt) {
  return ((performance.now() - startedAt) / 1000).toFixed(1);
}

async function call(request, method, path, data) {
  const response = await request.fetch(path, { method, data });
  if (!response.ok()) {
    const body = await response.text();
    let message = body.slice(0, 200);
    try {
      message = JSON.parse(body).message ?? message;
    } catch {
      // Not JSON, for example a proxy error page.
    }
    throw new Error(
      `${method} ${path} answered ${response.status()}: ${message}`,
    );
  }
  return response.status() === 204 ? undefined : response.json();
}

// Signs in once per account, because the sign-in route allows 10 requests per minute per IP.
async function signIn(context, credentials, registerIfMissing) {
  const login = await context.request.post('/api/auth/login', {
    data: credentials,
  });
  if (login.ok()) {
    return;
  }
  if (login.status() === 401 && registerIfMissing) {
    await call(context.request, 'POST', '/api/auth/register', credentials);
    console.log(`Registered ${credentials.email}.`);
    return;
  }
  const hint =
    login.status() === 429
      ? ' The sign-in route allows 10 requests per minute. Wait a minute and run again.'
      : '';
  throw new Error(
    `Signing in as ${credentials.email} answered ${login.status()}.${hint}`,
  );
}

async function waitFor(label, check, timeoutMs, timeoutMessage) {
  const startedAt = performance.now();
  while (!(await check())) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error(
        timeoutMessage ??
          `${label} did not happen within ${timeoutMs / 1000} s.`,
      );
    }
    await delay(pollMs);
  }
  console.log(`Waited ${secondsSince(startedAt)} s for ${label}.`);
}

// Other users' alerts can match the same event, so a row counts as ours by its user email.
async function deliveriesOf(request, eventId) {
  const rows = await call(
    request,
    'GET',
    '/api/admin/deliveries?limit=200',
  ).then((all) => all.filter((row) => row.eventId === eventId));
  const ours = (channel) =>
    rows.find(
      (row) => row.userEmail === account.email && row.channel === channel,
    )?.status;
  return {
    email: ours('email'),
    slack: ours('slack'),
    settled: rows.every(
      (row) => row.status !== 'pending' && row.status !== 'sending',
    ),
  };
}

function hasStatuses(request, eventId, expected) {
  return async () => {
    const actual = await deliveriesOf(request, eventId);
    return (
      actual.settled &&
      Object.entries(expected).every(
        ([channel, status]) => actual[channel] === status,
      )
    );
  };
}

// Ends the shot below the last content, so short pages have no empty lower half.
async function shoot(page, name, { bottom, margin = 32 } = {}) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const contentBottom =
    bottom ??
    (await page.evaluate(() =>
      Math.max(
        ...[...document.body.querySelectorAll('*')]
          .filter((element) => element.childElementCount === 0)
          .map(
            (element) =>
              element.getBoundingClientRect().bottom + window.scrollY,
          ),
      ),
    ));
  const height = Math.ceil(contentBottom + margin);
  await page.screenshot({
    path: join(outDir, name),
    fullPage: true,
    clip: { x: 0, y: 0, width: viewport.width, height },
    animations: 'disabled',
  });
  console.log(`Saved docs/screenshots/${name}, ${height} px high.`);
}

const runStartedAt = performance.now();

try {
  const response = await fetch(baseURL, { signal: AbortSignal.timeout(5000) });
  await response.body?.cancel();
} catch {
  fail(
    `${baseURL} does not answer. Start the stack first:\n  DELIVERY_BACKOFF_BASE_MS=2000 npm run dev`,
  );
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const newContext = () =>
  browser.newContext({
    baseURL,
    viewport,
    colorScheme: 'light',
    locale: 'en-US',
  });
const adminContext = await newContext();
const adminRequest = adminContext.request;
let savedSources;
let savedChannels;

try {
  const userContext = await newContext();
  const userRequest = userContext.request;
  await signIn(adminContext, admin, false);
  await signIn(userContext, account, true);

  // Known state: no timer events, both channels on, mock Slack answering, no data of this account.
  savedSources = await call(adminRequest, 'GET', '/api/admin/sources');
  savedChannels = await call(adminRequest, 'GET', '/api/admin/channels');
  for (const source of savedSources) {
    await call(adminRequest, 'PATCH', `/api/admin/sources/${source.id}`, {
      enabled: false,
    });
  }
  for (const channel of savedChannels) {
    await call(adminRequest, 'PATCH', `/api/admin/channels/${channel.id}`, {
      enabled: true,
    });
  }
  await call(adminRequest, 'PUT', '/api/dev/mock-slack/mode', { fail: false });
  // Alerts go first, because the API refuses to delete a target that an alert still uses.
  for (const path of ['/api/alerts', '/api/targets']) {
    for (const item of await call(userRequest, 'GET', `${path}?limit=200`)) {
      await call(userRequest, 'DELETE', `${path}/${item.id}`);
    }
  }

  const emailTarget = await call(userRequest, 'POST', '/api/targets', {
    name: 'Work email',
    channel: 'email',
    config: { address: account.email },
  });
  const slackTarget = await call(userRequest, 'POST', '/api/targets', {
    name: 'Team Slack',
    channel: 'slack',
    config: {
      webhookUrl: 'http://localhost:3000/api/dev/mock-slack/screenshots',
    },
  });
  const bothTargets = [emailTarget.id, slackTarget.id];
  // The list shows the newest alert first, so the earthquake alert is created last.
  await call(userRequest, 'POST', '/api/alerts', {
    name: 'Oil supply news',
    category: 'news',
    filters: { keywords: ['oil', 'OPEC', 'crude'] },
    minSeverity: 4,
    targetIds: [emailTarget.id],
    enabled: false,
  });
  await call(userRequest, 'POST', '/api/alerts', {
    name: 'Big tech moves',
    category: 'market',
    filters: {
      symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'],
      direction: 'any',
      minChangePct: 5,
    },
    minSeverity: 2,
    targetIds: bothTargets,
    enabled: true,
  });
  const quakeAlert = await call(userRequest, 'POST', '/api/alerts', {
    name: 'Strong earthquakes in Asia',
    category: 'disaster',
    filters: { types: ['earthquake'], regions: ['asia'], minMagnitude: 6 },
    minSeverity: 3,
    targetIds: bothTargets,
    enabled: true,
  });

  const inject = async (event) =>
    (await call(adminRequest, 'POST', '/api/dev/events', event)).event.id;

  const idS = await inject(eventS);
  await waitFor(
    'event S: email and Slack sent',
    hasStatuses(adminRequest, idS, { email: 'sent', slack: 'sent' }),
    waitTimeoutMs,
  );

  await call(adminRequest, 'PUT', '/api/dev/mock-slack/mode', { fail: true });
  const idA = await inject(eventA);
  await waitFor(
    'event A: Slack dead, email sent',
    hasStatuses(adminRequest, idA, { email: 'sent', slack: 'dead' }),
    deadTimeoutMs,
    `The Slack delivery of event A is not dead after ${deadTimeoutMs / 1000} s. ` +
      'Restart the stack with DELIVERY_BACKOFF_BASE_MS=2000 npm run dev, so failed deliveries retry within seconds.',
  );

  const idB = await inject(eventB);
  await waitFor(
    'event B: Slack failed',
    async () => (await deliveriesOf(adminRequest, idB)).slack === 'failed',
    waitTimeoutMs,
  );
  // A disabled channel holds the failed row in place.
  await call(adminRequest, 'PATCH', '/api/admin/channels/slack', {
    enabled: false,
  });

  const idC = await inject(eventC);
  await waitFor(
    'event C: email sent, Slack skipped',
    hasStatuses(adminRequest, idC, { email: 'sent', slack: 'skipped' }),
    waitTimeoutMs,
  );
  await waitFor(
    'final states of events S, A, B and C',
    async () =>
      (
        await Promise.all([
          hasStatuses(adminRequest, idS, { email: 'sent', slack: 'sent' })(),
          hasStatuses(adminRequest, idA, { email: 'sent', slack: 'dead' })(),
          hasStatuses(adminRequest, idB, { email: 'sent', slack: 'failed' })(),
          hasStatuses(adminRequest, idC, { email: 'sent', slack: 'skipped' })(),
        ])
      ).every(Boolean),
    waitTimeoutMs,
  );

  const anonymousContext = await newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto('/login');
  await anonymousPage.getByRole('button', { name: 'Sign in' }).waitFor();
  await shoot(anonymousPage, '01-sign-in.png');
  await anonymousContext.close();

  const userPage = await userContext.newPage();
  await userPage.goto('/alerts');
  for (const name of [
    'Strong earthquakes in Asia',
    'Big tech moves',
    'Oil supply news',
  ]) {
    await userPage.getByRole('link', { name: `Edit alert ${name}` }).waitFor();
  }
  await shoot(userPage, '02-alerts.png');

  await userPage.goto(`/alerts/${quakeAlert.id}`);
  await userPage.waitForFunction(
    (name) => document.querySelector('#alert-name')?.value === name,
    quakeAlert.name,
  );
  await shoot(userPage, '03-alert-form.png');

  await userPage.goto('/targets');
  for (const name of ['Work email', 'Team Slack']) {
    await userPage
      .getByRole('button', { name: `Send test to ${name}` })
      .waitFor();
  }
  await shoot(userPage, '04-targets.png');

  const runEventIds = [idS, idA, idB, idC];
  const runRowCount = (
    await call(adminRequest, 'GET', '/api/admin/deliveries?limit=200')
  ).filter((row) => runEventIds.includes(row.eventId)).length;
  const adminPage = await adminContext.newPage();
  await adminPage.goto('/admin/deliveries');
  const lastRunRow = adminPage.locator('tbody tr').nth(runRowCount - 1);
  await lastRunRow.waitFor();
  // The table lists every user's deliveries, newest first. Older rows differ between runs, so the shot ends at this run's last row.
  const box = await lastRunRow.boundingBox();
  await shoot(adminPage, '05-admin-deliveries.png', {
    bottom: box.y + box.height,
    margin: 0,
  });

  await adminPage.goto('/admin/metrics');
  await adminPage
    .getByRole('heading', { name: 'Failure rate per channel' })
    .waitFor();
  await shoot(adminPage, '06-admin-metrics.png');
} catch (error) {
  console.error(
    `\nscreenshots failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
} finally {
  const restoreSteps = [
    [
      'turn mock Slack fail mode off',
      () =>
        call(adminRequest, 'PUT', '/api/dev/mock-slack/mode', { fail: false }),
    ],
    ...(savedChannels ?? []).map((channel) => [
      `restore channel ${channel.id}`,
      () =>
        call(adminRequest, 'PATCH', `/api/admin/channels/${channel.id}`, {
          enabled: channel.enabled,
        }),
    ]),
    ...(savedSources ?? []).map((source) => [
      `restore source ${source.id}`,
      () =>
        call(adminRequest, 'PATCH', `/api/admin/sources/${source.id}`, {
          enabled: source.enabled,
        }),
    ]),
    ['close the browser', () => browser.close()],
  ];
  let restored = true;
  for (const [label, step] of restoreSteps) {
    try {
      await step();
    } catch (error) {
      console.error(
        `Could not ${label}: ${error instanceof Error ? error.message : error}`,
      );
      restored = false;
      process.exitCode = 1;
    }
  }
  if (restored) {
    console.log('Restored mock Slack fail mode, channels and sources.');
  }
  console.log(`Finished in ${secondsSince(runStartedAt)} s.`);
}
