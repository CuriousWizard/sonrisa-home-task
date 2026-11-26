import { z } from 'zod';
import { LIMITS, Name } from './common';
import { DisasterType, Region, Severity } from './enums';
import { TickerSymbol } from './events';

export const NewsFilters = z.strictObject({
  keywords: z
    .array(z.string().trim().min(1).max(LIMITS.keyword))
    .max(LIMITS.keywords),
});
export type NewsFilters = z.infer<typeof NewsFilters>;

export const MarketDirection = z.enum(['up', 'down', 'any']);
export type MarketDirection = z.infer<typeof MarketDirection>;

export const MarketFilters = z.strictObject({
  symbols: z.array(TickerSymbol).max(LIMITS.symbols),
  direction: MarketDirection,
  minChangePct: z.number().min(0),
});
export type MarketFilters = z.infer<typeof MarketFilters>;

export const DisasterFilters = z.strictObject({
  types: z.array(DisasterType).max(DisasterType.options.length),
  regions: z.array(Region).max(Region.options.length),
  minMagnitude: z.number().optional(),
});
export type DisasterFilters = z.infer<typeof DisasterFilters>;

const alertBase = {
  name: Name,
  minSeverity: Severity,
  targetIds: z
    .array(z.uuid())
    .min(1)
    .max(LIMITS.targetIds)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'targetIds must be unique',
    }),
  enabled: z.boolean(),
};

export const AlertInput = z.discriminatedUnion('category', [
  z.object({ ...alertBase, category: z.literal('news'), filters: NewsFilters }),
  z.object({
    ...alertBase,
    category: z.literal('market'),
    filters: MarketFilters,
  }),
  z.object({
    ...alertBase,
    category: z.literal('disaster'),
    filters: DisasterFilters,
  }),
]);
export type AlertInput = z.infer<typeof AlertInput>;

export type AlertDto = AlertInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
