import type { z } from 'zod';
import type { ChannelId, channels } from '@alerts/shared';
import type { Config } from '../config';
import type { NotificationChannel, NotificationMessage } from './channel';
import { createEmailChannel } from './email';
import { createSlackChannel } from './slack';

type ChannelConfig<K extends ChannelId> = z.infer<
  (typeof channels)[K]['configSchema']
>;

// Keyed by every shared ChannelId, so a channel without an implementation fails to compile.
export type ChannelRegistry = {
  readonly [K in ChannelId]: NotificationChannel<ChannelConfig<K>>;
};

export function createChannelRegistry(config: Config): ChannelRegistry {
  return {
    email: createEmailChannel(config),
    slack: createSlackChannel(config.SLACK_WEBHOOK_ALLOWED_PREFIXES),
  };
}

// The compiler cannot pair a channel id with its config type, so callers get the channel with config unknown.
export function channelById(
  registry: ChannelRegistry,
  id: ChannelId,
): NotificationChannel<unknown> {
  return registry[id];
}

// Stored config is parsed with the channel's own schema before it reaches send.
export async function sendThroughChannel(
  registry: ChannelRegistry,
  target: { channel: ChannelId; config: unknown },
  message: NotificationMessage,
): Promise<void> {
  const channel = channelById(registry, target.channel);
  const parsed = channel.configSchema.safeParse(target.config);
  if (!parsed.success) {
    throw new Error('Stored target config is invalid');
  }
  await channel.send(parsed.data, message);
}
