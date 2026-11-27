import type { Category, EventInput } from '@alerts/shared';

export type NewEvent = EventInput & { sourceId: string; externalId: string };

export interface EventSource {
  readonly id: string;
  readonly category: Category;
  // Delay before the next poll.
  nextDelayMs(): number;
  poll(): Promise<NewEvent[]>;
}

// Returns a number in [0, 1), like Math.random.
export type Random = () => number;

export interface SimulatorOptions {
  minIntervalMs: number;
  maxIntervalMs: number;
  random?: Random;
}
