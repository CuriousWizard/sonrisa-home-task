import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client';
import { sources } from '../db/schema';
import { ingestEvent } from '../events/ingest';
import type { EventSource, NewEvent } from './source';

export interface SchedulerDeps {
  db: Db;
  sources: readonly EventSource[];
  log: Pick<FastifyBaseLogger, 'error'>;
  ingest?: (db: Db, event: NewEvent) => Promise<unknown>;
}

// A source without a row was never registered, so it counts as disabled.
async function isEnabled(db: Db, sourceId: string): Promise<boolean> {
  const [row] = await db
    .select({ enabled: sources.enabled })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  return row?.enabled ?? false;
}

// The returned stop function resolves once no poll is running.
export function startScheduler(deps: SchedulerDeps): () => Promise<void> {
  const { db, log, ingest = ingestEvent } = deps;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const running = new Set<Promise<void>>();
  let stopped = false;

  async function tick(source: EventSource): Promise<void> {
    try {
      if (!(await isEnabled(db, source.id))) {
        return;
      }
      for (const event of await source.poll()) {
        await ingest(db, event);
      }
    } catch (error) {
      log.error({ err: error, sourceId: source.id }, 'Source poll failed');
    }
  }

  function schedule(source: EventSource): void {
    if (stopped) {
      return;
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      const run = tick(source).finally(() => {
        running.delete(run);
        schedule(source);
      });
      running.add(run);
    }, source.nextDelayMs());
    timers.add(timer);
  }

  deps.sources.forEach(schedule);

  return async () => {
    stopped = true;
    timers.forEach(clearTimeout);
    timers.clear();
    await Promise.all(running);
  };
}
