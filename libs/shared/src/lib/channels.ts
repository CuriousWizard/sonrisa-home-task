import { z } from 'zod';
import { LIMITS, Name } from './common';

export const EmailConfig = z.object({
  address: z.string().trim().pipe(z.email().max(LIMITS.email)),
});
export type EmailConfig = z.infer<typeof EmailConfig>;

// Only the URL shape. The API checks SLACK_WEBHOOK_ALLOWED_PREFIXES.
export const SlackConfig = z.object({
  webhookUrl: z.url({ protocol: /^https?$/ }).max(LIMITS.url),
});
export type SlackConfig = z.infer<typeof SlackConfig>;

export interface ChannelField {
  key: string;
  label: string;
  inputType: 'text' | 'email' | 'url';
}

export interface ChannelDefinition {
  configSchema: z.ZodObject;
  label: string;
  fields: readonly ChannelField[];
}

export const channels = {
  email: {
    configSchema: EmailConfig,
    label: 'Email',
    fields: [{ key: 'address', label: 'Email address', inputType: 'email' }],
  },
  slack: {
    configSchema: SlackConfig,
    label: 'Slack',
    fields: [{ key: 'webhookUrl', label: 'Webhook URL', inputType: 'url' }],
  },
} satisfies Record<string, ChannelDefinition>;

export type ChannelId = keyof typeof channels;
const channelIds = Object.keys(channels) as [ChannelId, ...ChannelId[]];
export const ChannelId = z.enum(channelIds);

type TargetBranch<K extends ChannelId> = z.ZodObject<{
  name: typeof Name;
  channel: z.ZodLiteral<K>;
  config: (typeof channels)[K]['configSchema'];
}>;
type AnyTargetBranch = { [K in ChannelId]: TargetBranch<K> }[ChannelId];

// The cast restores the per-channel pairing that Array.map loses.
const targetBranches = channelIds.map((id) =>
  z.object({
    name: Name,
    channel: z.literal(id),
    config: channels[id].configSchema,
  }),
) as [AnyTargetBranch, ...AnyTargetBranch[]];

export const TargetInput = z.discriminatedUnion('channel', targetBranches);
export type TargetInput = z.infer<typeof TargetInput>;

export type TargetDto = TargetInput & { id: string; createdAt: string };

export type TargetTestResult = { ok: true } | { ok: false; error: string };
