import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const envPath = join(root, '.env');
const placeholderLine = 'JWT_SECRET=replace-with-at-least-32-random-characters';

function fail(message) {
  console.error(`\nsetup failed: ${message}`);
  process.exit(1);
}

if (existsSync(envPath)) {
  console.log('.env exists, leaving it unchanged.');
} else {
  const example = readFileSync(join(root, '.env.example'), 'utf8');
  if (!example.includes(placeholderLine)) {
    fail(`.env.example has no "${placeholderLine}" line to replace.`);
  }
  const secret = randomBytes(48).toString('base64url');
  writeFileSync(
    envPath,
    example.replace(placeholderLine, `JWT_SECRET=${secret}`),
    { flag: 'wx', mode: 0o600 },
  );
  console.log('Created .env from .env.example with a random JWT_SECRET.');
}

console.log('Starting Postgres and Mailpit with docker compose...');
const compose = spawnSync('docker', ['compose', 'up', '-d', '--wait'], {
  cwd: root,
  stdio: 'inherit',
});
if (compose.error || compose.status !== 0) {
  const reason = compose.error
    ? compose.error.message
    : `exit code ${compose.status}`;
  fail(
    `"docker compose up -d --wait" did not succeed (${reason}).\n` +
      'Check that Docker is running, that your user can reach it ("docker info"),\n' +
      'and that ports 5432, 1025 and 8025 are free on 127.0.0.1.',
  );
}

// M3: apply migrations to both databases and seed the two users here.

console.log('Postgres and Mailpit are healthy.');
