import { z } from 'zod';
import { LIMITS } from './common';
import { Category, DisasterType, Region, Severity } from './enums';

export const TickerSymbol = z.string().trim().min(1).max(LIMITS.symbol);

export const NewsEventData = z.strictObject({});
export type NewsEventData = z.infer<typeof NewsEventData>;

export const MarketEventData = z.strictObject({
  symbol: TickerSymbol,
  price: z.number(),
  changePct: z.number(),
});
export type MarketEventData = z.infer<typeof MarketEventData>;

export const DisasterEventData = z.strictObject({
  type: DisasterType,
  region: Region,
  magnitude: z.number().optional(),
});
export type DisasterEventData = z.infer<typeof DisasterEventData>;

const eventBase = {
  title: z.string().trim().min(1).max(LIMITS.title),
  summary: z.string().trim().max(LIMITS.summary).default(''),
  severity: Severity,
  occurredAt: z.iso.datetime({ offset: true }).optional(),
};

export const EventInput = z.discriminatedUnion('category', [
  z.object({ ...eventBase, category: z.literal('news'), data: NewsEventData }),
  z.object({
    ...eventBase,
    category: z.literal('market'),
    data: MarketEventData,
  }),
  z.object({
    ...eventBase,
    category: z.literal('disaster'),
    data: DisasterEventData,
  }),
]);
export type EventInput = z.infer<typeof EventInput>;

interface EventDataByCategory {
  news: NewsEventData;
  market: MarketEventData;
  disaster: DisasterEventData;
}

export type EventDto = {
  [K in Category]: { category: K; data: EventDataByCategory[K] };
}[Category] & {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  severity: Severity;
  occurredAt: string;
  createdAt: string;
};
