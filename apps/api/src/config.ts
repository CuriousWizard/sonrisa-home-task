import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { RegisterInput } from '@alerts/shared';

export const JWT_SECRET_PLACEHOLDER =
  'replace-with-at-least-32-random-characters';

// This file lives in apps/api/src, three levels below the repository root.
const rootEnvPath = resolve(__dirname, '../../../.env');

export function loadRootEnvFile(): void {
  if (existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
  }
}

const positiveInt = z.coerce.number().int().positive();
const port = positiveInt.max(65535);
const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

// Messages refer to the entry by position, because an entry may hold credentials.
function prefixProblem(entry: string): string | undefined {
  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    return 'is not a valid URL';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'must use https: or http:';
  }
  if (url.username !== '' || url.password !== '') {
    return 'must not contain a username or password';
  }
  if (!entry.endsWith('/')) {
    return 'must end with "/"';
  }
  // A prefix such as https://host/a/../ would normalize to a broader prefix.
  if (url.search !== '' || url.hash !== '' || url.href !== entry) {
    return 'must be a normalized URL without query or fragment';
  }
  return undefined;
}

const slackPrefixes = z.string().transform((value, ctx) => {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  entries.forEach((entry, index) => {
    const problem = prefixProblem(entry);
    if (problem) {
      ctx.addIssue({ code: 'custom', message: `entry ${index + 1} ${problem}` });
    }
  });
  return entries;
});

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: port,
    DATABASE_URL: postgresUrl,
    TEST_DATABASE_URL: postgresUrl,
    JWT_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters')
      .refine((value) => value !== JWT_SECRET_PLACEHOLDER, {
        message: 'must not be the placeholder from .env.example',
      }),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: port,
    MAIL_FROM: z.email(),
    SLACK_WEBHOOK_ALLOWED_PREFIXES: slackPrefixes,
    AUTH_RATE_LIMIT_MAX: positiveInt,
    WORKER_POLL_MS: positiveInt,
    DELIVERY_MAX_ATTEMPTS: positiveInt,
    DELIVERY_BACKOFF_BASE_MS: positiveInt,
    DELIVERY_LEASE_MS: positiveInt,
    SOURCE_MIN_INTERVAL_MS: positiveInt,
    SOURCE_MAX_INTERVAL_MS: positiveInt,
    SEED_ADMIN_EMAIL: RegisterInput.shape.email,
    SEED_ADMIN_PASSWORD: RegisterInput.shape.password,
    SEED_USER_EMAIL: RegisterInput.shape.email,
    SEED_USER_PASSWORD: RegisterInput.shape.password,
  })
  .superRefine((config, ctx) => {
    if (config.SOURCE_MIN_INTERVAL_MS > config.SOURCE_MAX_INTERVAL_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SOURCE_MIN_INTERVAL_MS'],
        message: 'must not be greater than SOURCE_MAX_INTERVAL_MS',
      });
    }
    if (config.NODE_ENV !== 'production') {
      return;
    }
    config.SLACK_WEBHOOK_ALLOWED_PREFIXES.forEach((entry, index) => {
      if (entry.startsWith('http:')) {
        ctx.addIssue({
          code: 'custom',
          path: ['SLACK_WEBHOOK_ALLOWED_PREFIXES'],
          message: `entry ${index + 1} uses http:, which production does not allow`,
        });
      }
    });
  });

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
