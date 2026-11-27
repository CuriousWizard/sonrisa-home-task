import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString: url });
  // Without a listener, an error on an idle client would crash the process.
  pool.on('error', (error) => {
    console.error(`Postgres pool error: ${error.message}`);
  });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}
