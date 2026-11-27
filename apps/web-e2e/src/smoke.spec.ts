import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

interface Account {
  email: string;
  password: string;
}

const user: Account = {
  email: 'user@example.local',
  password: 'user-password-123',
};
const admin: Account = {
  email: 'admin@example.local',
  password: 'admin-password-123',
};

const suffix = randomUUID().slice(0, 8);
const targetName = `E2E Slack ${suffix}`;
const alertName = `E2E market ${suffix}`;
const eventTitle = `E2E move ${suffix}`;
const symbol = `E${suffix.slice(0, 7).toUpperCase()}`;
const hookId = `e2e-${suffix}`;
const webhookUrl = `http://localhost:3000/api/dev/mock-slack/${hookId}`;

async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/alerts$/);
}

async function deleteE2eItems(
  request: APIRequestContext,
  path: string,
): Promise<void> {
  const list = await request.get(`${path}?limit=200`);
  await expect(list).toBeOK();
  const items = (await list.json()) as { id: string; name: string }[];
  for (const item of items.filter((entry) => entry.name.startsWith('E2E '))) {
    await expect(await request.delete(`${path}/${item.id}`)).toBeOK();
  }
}

// Deletes every E2E alert and target, including those of an earlier run that failed to clean up.
async function deleteE2eData(request: APIRequestContext): Promise<void> {
  await expect(await request.post('/api/auth/login', { data: user })).toBeOK();
  // Alerts go first, because the API refuses to delete a target that an alert still uses.
  await deleteE2eItems(request, '/api/alerts');
  await deleteE2eItems(request, '/api/targets');
}

test.beforeEach(async ({ page }) => {
  await deleteE2eData(page.request);
  // The test signs in through the form, so it starts signed out.
  await expect(await page.request.post('/api/auth/logout')).toBeOK();
});

test.afterEach(async ({ page }) => {
  await deleteE2eData(page.request);
});

test('a market event reaches the mock Slack receiver and the admin sees it sent', async ({
  page,
}) => {
  await signIn(page, user);

  await page.goto('/targets');
  await page.getByLabel('Name', { exact: true }).fill(targetName);
  await page.getByLabel('Channel', { exact: true }).selectOption({
    label: 'Slack',
  });
  await page.getByLabel('Webhook URL', { exact: true }).fill(webhookUrl);
  await page.getByRole('button', { name: 'Add target' }).click();
  await expect(
    page.getByRole('button', { name: `Send test to ${targetName}` }),
  ).toBeVisible();

  await page.goto('/alerts/new');
  await page.getByLabel('Name', { exact: true }).fill(alertName);
  await page.getByLabel('Category', { exact: true }).selectOption({
    label: 'Market',
  });
  await page.getByLabel('Symbols', { exact: true }).fill(symbol);
  await page.getByLabel('Direction', { exact: true }).selectOption({
    label: 'Any',
  });
  await page.getByLabel('Minimum change in percent', { exact: true }).fill('5');
  await page.getByLabel('Minimum severity', { exact: true }).selectOption({
    label: '1',
  });
  await page.getByRole('checkbox', { name: targetName }).check();
  await page.getByRole('button', { name: 'Create alert' }).click();
  await expect(page).toHaveURL(/\/alerts$/);
  await expect(
    page.getByRole('link', { name: `Edit alert ${alertName}` }),
  ).toBeVisible();

  const alerts = await page.request.get('/api/alerts?limit=200');
  await expect(alerts).toBeOK();
  const saved = ((await alerts.json()) as { name: string }[]).find(
    (alert) => alert.name === alertName,
  );
  expect(saved).toMatchObject({
    category: 'market',
    filters: { symbols: [symbol], direction: 'any', minChangePct: 5 },
  });

  const injected = await page.request.post('/api/dev/events', {
    data: {
      category: 'market',
      title: eventTitle,
      severity: 1,
      data: { symbol, price: 100, changePct: 8 },
    },
  });
  await expect(injected).toBeOK();
  // Other alerts in the dev database can match the event too.
  const { deliveriesCreated } = (await injected.json()) as {
    deliveriesCreated: number;
  };
  expect(deliveriesCreated).toBeGreaterThanOrEqual(1);

  await expect
    .poll(
      async () => {
        const response = await page.request.get('/api/dev/mock-slack/messages');
        const messages = (await response.json()) as {
          hookId: string;
          text: string;
        }[];
        return messages
          .filter((message) => message.hookId === hookId)
          .map((message) => message.text);
      },
      { timeout: 30_000 },
    )
    .toContainEqual(expect.stringContaining(eventTitle));

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, admin);
  await page.goto('/admin/deliveries');
  const sent = page
    .getByRole('row', { name: eventTitle })
    .getByText('Sent', { exact: true });
  const refresh = page.getByRole('button', { name: 'Refresh' });
  // The worker marks the row sent after the mock receiver answers, so the first load can still show it sending.
  await expect
    .poll(
      async () => {
        const loaded = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            new URL(response.url()).pathname === '/api/admin/deliveries',
        );
        await refresh.click();
        await loaded;
        return sent.isVisible();
      },
      { timeout: 30_000 },
    )
    .toBe(true);
});
