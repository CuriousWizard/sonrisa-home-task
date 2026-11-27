import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { loadConfig } from './config';

const example = parseEnv(
  readFileSync(resolve(import.meta.dirname, '../../../.env.example'), 'utf8'),
);
const validSecret = randomBytes(36).toString('base64url');

function exampleWith(overrides: Record<string, string>) {
  return { ...example, JWT_SECRET: validSecret, ...overrides };
}

function configError(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('loadConfig accepted the configuration');
}

describe('loadConfig', () => {
  it('accepts the values in .env.example with a valid 48-character secret', () => {
    expect(validSecret).toHaveLength(48);
    const config = loadConfig(exampleWith({}));
    expect(config.PORT).toBe(3000);
    expect(config.SLACK_WEBHOOK_ALLOWED_PREFIXES).toEqual([
      'https://hooks.slack.com/services/',
      'http://localhost:3000/api/dev/mock-slack/',
    ]);
  });

  it('rejects the placeholder secret from .env.example', () => {
    const message = configError(example);
    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain(example.JWT_SECRET);
  });

  it('rejects a 31-character secret', () => {
    const shortSecret = validSecret.slice(0, 31);
    const message = configError(exampleWith({ JWT_SECRET: shortSecret }));
    expect(message).toContain('JWT_SECRET: must be at least 32 characters');
    expect(message).not.toContain(shortSecret);
  });

  it('rejects a Slack prefix without a trailing slash', () => {
    const message = configError(
      exampleWith({
        SLACK_WEBHOOK_ALLOWED_PREFIXES: 'https://hooks.slack.com/services',
      }),
    );
    expect(message).toContain(
      'SLACK_WEBHOOK_ALLOWED_PREFIXES: entry 1 must end with "/"',
    );
  });

  it('rejects a Slack prefix with a username', () => {
    const message = configError(
      exampleWith({
        SLACK_WEBHOOK_ALLOWED_PREFIXES:
          'https://hookuser@hooks.slack.com/services/',
      }),
    );
    expect(message).toContain(
      'SLACK_WEBHOOK_ALLOWED_PREFIXES: entry 1 must not contain a username or password',
    );
    expect(message).not.toContain('hookuser');
  });

  it('rejects SOURCE_MIN_INTERVAL_MS greater than SOURCE_MAX_INTERVAL_MS', () => {
    const message = configError(
      exampleWith({
        SOURCE_MIN_INTERVAL_MS: '60000',
        SOURCE_MAX_INTERVAL_MS: '20000',
      }),
    );
    expect(message).toContain(
      'SOURCE_MIN_INTERVAL_MS: must not be greater than SOURCE_MAX_INTERVAL_MS',
    );
    expect(() =>
      loadConfig(
        exampleWith({
          SOURCE_MIN_INTERVAL_MS: '30000',
          SOURCE_MAX_INTERVAL_MS: '30000',
        }),
      ),
    ).not.toThrow();
  });

  it('rejects DELIVERY_LEASE_MS shorter than twice DELIVERY_SEND_TIMEOUT_MS', () => {
    const message = configError(
      exampleWith({
        DELIVERY_LEASE_MS: '39999',
        DELIVERY_SEND_TIMEOUT_MS: '20000',
      }),
    );
    expect(message).toContain(
      'DELIVERY_LEASE_MS: must be at least twice DELIVERY_SEND_TIMEOUT_MS',
    );
    expect(() =>
      loadConfig(
        exampleWith({
          DELIVERY_LEASE_MS: '40000',
          DELIVERY_SEND_TIMEOUT_MS: '20000',
        }),
      ),
    ).not.toThrow();
    const unset = { ...exampleWith({}), DELIVERY_SEND_TIMEOUT_MS: undefined };
    expect(loadConfig(unset).DELIVERY_SEND_TIMEOUT_MS).toBe(20000);
  });

  it('rejects an http: Slack prefix when NODE_ENV is production', () => {
    const message = configError(exampleWith({ NODE_ENV: 'production' }));
    expect(message).toContain(
      'SLACK_WEBHOOK_ALLOWED_PREFIXES: entry 2 uses http:',
    );
    expect(() =>
      loadConfig(
        exampleWith({
          NODE_ENV: 'production',
          SLACK_WEBHOOK_ALLOWED_PREFIXES: 'https://hooks.slack.com/services/',
        }),
      ),
    ).not.toThrow();
  });
});
