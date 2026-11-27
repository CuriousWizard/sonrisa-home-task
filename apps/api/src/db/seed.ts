import type { Role } from '@alerts/shared';
import { hashPassword } from '../auth/password';
import { loadConfig, loadRootEnvFile } from '../config';
import { safeErrorLog } from '../safe-error-log';
import { createDb, type Db } from './client';
import { users } from './schema';

async function ensureUser(
  db: Db,
  email: string,
  password: string,
  role: Role,
): Promise<void> {
  const inserted = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), role })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  console.log(
    inserted.length > 0
      ? `Created ${role} ${email}.`
      : `${email} already exists, left unchanged.`,
  );
}

async function main(): Promise<void> {
  loadRootEnvFile();
  const config = loadConfig(process.env);
  const { db, pool } = createDb(config.DATABASE_URL);
  try {
    await ensureUser(
      db,
      config.SEED_ADMIN_EMAIL,
      config.SEED_ADMIN_PASSWORD,
      'admin',
    );
    await ensureUser(
      db,
      config.SEED_USER_EMAIL,
      config.SEED_USER_PASSWORD,
      'user',
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seeding failed:', safeErrorLog(error));
  process.exitCode = 1;
});
