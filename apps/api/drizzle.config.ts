import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// db:generate runs drizzle-kit in apps/api, where tsconfig.json maps @alerts/shared.
if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
