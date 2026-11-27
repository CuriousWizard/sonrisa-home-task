import { EventInput } from '@alerts/shared';
import { earthquakeSeverity, marketSeverity } from '../../matching/severity';
import type { EventSource, NewEvent, Random } from '../source';
import { createDisasterSource } from './disaster';
import { createMarketSource } from './market';
import { createNewsSource } from './news';

const MIN_MS = 20_000;
const MAX_MS = 60_000;
const POLLS = 300;

// mulberry32: a small seeded generator, so every run sees the same values.
function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const factories = {
  news: createNewsSource,
  market: createMarketSource,
  disaster: createDisasterSource,
};

function source(
  factory: (typeof factories)[keyof typeof factories],
  random: Random,
): EventSource {
  return factory({ minIntervalMs: MIN_MS, maxIntervalMs: MAX_MS, random });
}

async function pollMany(eventSource: EventSource): Promise<NewEvent[]> {
  const polled: NewEvent[] = [];
  for (let i = 0; i < POLLS; i++) {
    const batch = await eventSource.poll();
    expect(batch).toHaveLength(1);
    polled.push(...batch);
  }
  return polled;
}

describe.each(Object.entries(factories))(
  '%s simulator',
  (category, factory) => {
    it('returns events that pass the shared EventInput schema', async () => {
      const eventSource = source(factory, seeded(1));
      expect(eventSource.category).toBe(category);
      const polled = await pollMany(eventSource);
      for (const event of polled) {
        expect(EventInput.safeParse(event).error).toBeUndefined();
        expect(event.category).toBe(category);
        expect(event.sourceId).toBe(eventSource.id);
      }
      expect(new Set(polled.map((event) => event.externalId)).size).toBe(POLLS);
    });

    it.each([0, 0.999999])(
      'returns a valid event when random always returns %s',
      async (value) => {
        const [event] = await source(factory, () => value).poll();
        expect(EventInput.safeParse(event).error).toBeUndefined();
      },
    );

    it('nextDelayMs stays within the bounds and changes between calls', () => {
      expect(source(factory, () => 0).nextDelayMs()).toBe(MIN_MS);
      expect(source(factory, () => 0.999999).nextDelayMs()).toBe(MAX_MS);

      const values = [0.1, 0.7];
      const twoValues = source(factory, () => values.shift() ?? 0);
      expect(twoValues.nextDelayMs()).not.toBe(twoValues.nextDelayMs());

      const eventSource = source(factory, seeded(2));
      for (let i = 0; i < 1000; i++) {
        const delay = eventSource.nextDelayMs();
        expect(Number.isInteger(delay)).toBe(true);
        expect(delay).toBeGreaterThanOrEqual(MIN_MS);
        expect(delay).toBeLessThanOrEqual(MAX_MS);
      }
    });
  },
);

describe('simulator severity', () => {
  it('market severity follows marketSeverity(changePct)', async () => {
    const polled = await pollMany(source(createMarketSource, seeded(3)));
    const severities = new Set<number>();
    for (const event of polled) {
      if (event.category !== 'market') {
        throw new Error('expected a market event');
      }
      expect(event.severity).toBe(marketSeverity(event.data.changePct));
      severities.add(event.severity);
    }
    expect(severities.size).toBeGreaterThan(1);
  });

  it('earthquake severity follows earthquakeSeverity(magnitude), other types have no magnitude', async () => {
    const polled = await pollMany(source(createDisasterSource, seeded(4)));
    let earthquakes = 0;
    for (const event of polled) {
      if (event.category !== 'disaster') {
        throw new Error('expected a disaster event');
      }
      if (event.data.type === 'earthquake') {
        earthquakes++;
        expect(event.data.magnitude).toBeDefined();
        expect(event.severity).toBe(
          earthquakeSeverity(event.data.magnitude ?? 0),
        );
      } else {
        expect(event.data.magnitude).toBeUndefined();
      }
    }
    expect(earthquakes).toBeGreaterThan(0);
  });

  it('news titles start with "Breaking:" exactly for severity 4 and 5', async () => {
    const polled = await pollMany(source(createNewsSource, seeded(5)));
    for (const event of polled) {
      expect(event.title.startsWith('Breaking:')).toBe(event.severity >= 4);
    }
    expect(polled.some((event) => event.severity >= 4)).toBe(true);
    expect(polled.some((event) => event.severity < 4)).toBe(true);
  });
});
