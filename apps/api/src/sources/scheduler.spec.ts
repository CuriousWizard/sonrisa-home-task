import { inArray } from 'drizzle-orm';
import type { Pool } from 'pg';
import { loadConfig } from '../config';
import { createDb, type Db } from '../db/client';
import { sources } from '../db/schema';
import { startScheduler } from './scheduler';
import type { EventSource, NewEvent } from './source';

const ON = 'scheduler-test-on';
const OFF = 'scheduler-test-off';
// Far above the fake time vi.waitFor advances while it retries.
const DELAY_MS = 60_000;

describe('startScheduler', () => {
  let db: Db;
  let pool: Pool;
  let stop: (() => Promise<void>) | undefined;
  const ingest = vi.fn<(db: Db, event: NewEvent) => Promise<unknown>>(
    async () => undefined,
  );
  const log = { error: vi.fn() };

  beforeAll(async () => {
    const config = loadConfig(process.env);
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    await db.delete(sources).where(inArray(sources.id, [ON, OFF]));
    await db.insert(sources).values([
      { id: ON, category: 'news', enabled: true },
      { id: OFF, category: 'news', enabled: false },
    ]);
  });

  beforeEach(() => {
    // Only timers are fake, so the scheduler's database reads still run.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(async () => {
    await stop?.();
    stop = undefined;
    vi.useRealTimers();
    ingest.mockClear();
    log.error.mockClear();
  });

  afterAll(async () => {
    await db?.delete(sources).where(inArray(sources.id, [ON, OFF]));
    await pool?.end();
  });

  function event(sourceId: string): NewEvent {
    return {
      sourceId,
      externalId: 'not stored',
      category: 'news',
      title: 'Stub event',
      summary: '',
      severity: 1,
      data: {},
    };
  }

  function stubSource(id: string, poll = vi.fn(async () => [event(id)])) {
    return {
      id,
      category: 'news',
      nextDelayMs: vi.fn(() => DELAY_MS),
      poll,
    } satisfies EventSource;
  }

  it('polls an enabled source and skips a disabled one', async () => {
    const on = stubSource(ON);
    const off = stubSource(OFF);
    stop = startScheduler({ db, sources: [on, off], ingest, log });

    await vi.advanceTimersByTimeAsync(DELAY_MS - 1);
    expect(on.poll).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    // The second nextDelayMs call means the tick finished and the next one is scheduled.
    await vi.waitFor(() => {
      expect(on.nextDelayMs).toHaveBeenCalledTimes(2);
      expect(off.nextDelayMs).toHaveBeenCalledTimes(2);
    });
    expect(on.poll).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledWith(db, event(ON));
    expect(off.poll).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('logs a throwing poll and keeps the chain going until stop', async () => {
    const poll = vi
      .fn<() => Promise<NewEvent[]>>()
      .mockRejectedValueOnce(new Error('feed unavailable'))
      .mockResolvedValue([event(ON)]);
    const on = stubSource(ON, poll);
    stop = startScheduler({ db, sources: [on], ingest, log });

    await vi.advanceTimersByTimeAsync(DELAY_MS);
    await vi.waitFor(() => expect(on.nextDelayMs).toHaveBeenCalledTimes(2));
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(ingest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DELAY_MS);
    await vi.waitFor(() => expect(on.nextDelayMs).toHaveBeenCalledTimes(3));
    expect(on.poll).toHaveBeenCalledTimes(2);
    expect(ingest).toHaveBeenCalledTimes(1);

    await stop();
    await vi.advanceTimersByTimeAsync(DELAY_MS * 2);
    expect(on.poll).toHaveBeenCalledTimes(2);
  });
});
