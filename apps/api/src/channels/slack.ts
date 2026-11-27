import { SlackConfig } from '@alerts/shared';
import type { NotificationChannel } from './channel';
import { assertAllowedSlackUrl } from './slack-url';

const DEFAULT_TIMEOUT_MS = 5000;

export interface SlackChannelOptions {
  timeoutMs?: number;
}

// Slack reads <...> as links and mentions such as <!channel>, so event text must not create them.
function escapeSlack(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function createSlackChannel(
  allowedPrefixes: readonly string[],
  options: SlackChannelOptions = {},
): NotificationChannel<SlackConfig> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    id: 'slack',
    configSchema: SlackConfig,
    assertConfigAllowed(config) {
      assertAllowedSlackUrl(config.webhookUrl, allowedPrefixes);
    },
    async send(config, message) {
      const url = assertAllowedSlackUrl(config.webhookUrl, allowedPrefixes);
      const text = `*${escapeSlack(message.subject)}*\n${escapeSlack(message.text)}`;
      const signal = AbortSignal.timeout(timeoutMs);
      let status: number;
      try {
        const response = await fetch(url.href, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
          redirect: 'error',
          signal,
        });
        status = response.status;
        await response.body?.cancel();
      } catch {
        // The fetch error and its cause can hold the URL, so neither is passed on.
        throw new Error(
          signal.aborted ? 'Slack request timed out' : 'Slack request failed',
        );
      }
      if (status < 200 || status > 299) {
        throw new Error(`Slack responded ${status}`);
      }
    },
  };
}
