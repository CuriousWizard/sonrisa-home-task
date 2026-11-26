import { z } from 'zod';

export const LIMITS = {
  name: 100,
  email: 254,
  passwordMin: 10,
  passwordMax: 128,
  title: 200,
  summary: 2000,
  keyword: 50,
  keywords: 20,
  symbol: 12,
  symbols: 20,
  targetIds: 20,
  url: 2048,
  slackText: 10_000,
  listDefault: 50,
  listMax: 200,
  sourceId: 50,
  hookId: 64,
} as const;

export const Name = z.string().trim().min(1).max(LIMITS.name);

export const ListQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.listMax)
    .default(LIMITS.listDefault),
});
export type ListQuery = z.infer<typeof ListQuery>;

export const PatchEnabled = z.object({ enabled: z.boolean() });
export type PatchEnabled = z.infer<typeof PatchEnabled>;
