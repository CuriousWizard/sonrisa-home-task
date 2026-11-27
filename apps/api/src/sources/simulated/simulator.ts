import { randomUUID } from 'node:crypto';
import type { Category, EventInput } from '@alerts/shared';
import type { EventSource, Random, SimulatorOptions } from '../source';

export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Each poll returns one generated event with a fresh externalId.
export function createSimulator<C extends Category>(
  id: string,
  category: C,
  options: SimulatorOptions,
  generate: (random: Random) => Extract<EventInput, { category: C }>,
): EventSource {
  const random = options.random ?? Math.random;
  return {
    id,
    category,
    nextDelayMs: () =>
      randomInt(random, options.minIntervalMs, options.maxIntervalMs),
    poll: async () => [
      { ...generate(random), sourceId: id, externalId: randomUUID() },
    ],
  };
}
