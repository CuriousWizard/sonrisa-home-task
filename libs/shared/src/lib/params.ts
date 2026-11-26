import { z } from 'zod';
import { ChannelId } from './channels';
import { LIMITS } from './common';

export const IdParam = z.object({ id: z.uuid() });
export type IdParam = z.infer<typeof IdParam>;

export const SourceIdParam = z.object({
  id: z
    .string()
    .min(1)
    .max(LIMITS.sourceId)
    .regex(/^[a-z0-9-]+$/),
});
export type SourceIdParam = z.infer<typeof SourceIdParam>;

export const ChannelIdParam = z.object({ id: ChannelId });
export type ChannelIdParam = z.infer<typeof ChannelIdParam>;

export const HookIdParam = z.object({
  hookId: z
    .string()
    .min(1)
    .max(LIMITS.hookId)
    .regex(/^[A-Za-z0-9_-]+$/),
});
export type HookIdParam = z.infer<typeof HookIdParam>;
