import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig, loadRootEnvFile } from '../config';
import { createDb } from './client';

const migrationsFolder = resolve(__dirname, 'migrations');

async function migrateDatabase(name: string, url: string): Promise<void> {
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
    console.log(`Applied migrations to ${name}.`);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  loadRootEnvFile();
  const config = loadConfig(process.env);
  await migrateDatabase('DATABASE_URL', config.DATABASE_URL);
  await migrateDatabase('TEST_DATABASE_URL', config.TEST_DATABASE_URL);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
