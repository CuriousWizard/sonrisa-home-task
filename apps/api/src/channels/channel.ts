import type { ZodType } from 'zod';
import type { ChannelId } from '@alerts/shared';

export interface NotificationMessage {
  subject: string;
  text: string;
}

export interface NotificationChannel<C> {
  readonly id: ChannelId;
  readonly configSchema: ZodType<C>;
  // Extra server-side checks, such as the Slack URL allowlist. Throws on invalid config.
  assertConfigAllowed?(config: C): void;
  // Throws on failure with a message that contains no secrets. The worker stores it in last_error.
  send(config: C, message: NotificationMessage): Promise<void>;
}
