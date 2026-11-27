import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';

export interface SafeErrorLog {
  name: string;
  code?: string;
  constraint?: string;
  message?: string;
  stack?: string;
  cause?: SafeErrorLog;
}

// Drizzle and Postgres messages can quote bound parameters such as password hashes and webhook URLs.
export function safeErrorLog(error: unknown): SafeErrorLog {
  if (!(error instanceof Error)) {
    return { name: typeof error };
  }
  const dbError =
    error instanceof DatabaseError
      ? error
      : error.cause instanceof DatabaseError
        ? error.cause
        : undefined;
  if (dbError) {
    return {
      name: error.name,
      code: dbError.code,
      constraint: dbError.constraint,
    };
  }
  if (error instanceof DrizzleQueryError) {
    // The cause is a driver error such as a lost connection, which holds no SQL.
    return { name: error.name, cause: safeErrorLog(error.cause) };
  }
  return { name: error.name, message: error.message, stack: error.stack };
}
