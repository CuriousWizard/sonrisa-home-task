import type { EventDto, Region } from '@alerts/shared';
import type { NotificationMessage } from '../channels/channel';

type PickEach<T, K extends keyof T> = T extends unknown ? Pick<T, K> : never;

// One branch per category, so data stays paired with its category.
export type MessageEvent = PickEach<
  EventDto,
  'category' | 'title' | 'summary' | 'severity' | 'data'
>;

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function regionName(region: Region): string {
  return region.split('-').map(capitalize).join(' ');
}

function describeData(event: MessageEvent): string | undefined {
  switch (event.category) {
    case 'news':
      return undefined;
    case 'market': {
      const { symbol, price, changePct } = event.data;
      const shownPrice = numberFormat.format(price);
      if (changePct === 0) {
        return `${symbol} is unchanged at ${shownPrice}.`;
      }
      const verb = changePct > 0 ? 'rose' : 'fell';
      return `${symbol} ${verb} ${numberFormat.format(Math.abs(changePct))}% to ${shownPrice}.`;
    }
    case 'disaster': {
      const { type, region, magnitude } = event.data;
      const size =
        magnitude === undefined
          ? ''
          : `, magnitude ${numberFormat.format(magnitude)}`;
      return `${capitalize(type)} in ${regionName(region)}${size}.`;
    }
  }
}

export function buildMessage(
  event: MessageEvent,
  alertName: string,
): NotificationMessage {
  const lines = [
    event.summary,
    `Severity: ${event.severity} of 5`,
    describeData(event),
    `Alert: ${alertName}`,
  ].filter((line): line is string => line !== undefined && line !== '');
  return {
    subject: `[${event.category}] ${event.title}`,
    text: lines.join('\n'),
  };
}

export function buildTestMessage(targetName: string): NotificationMessage {
  return {
    subject: 'Test message',
    text: `This is a test message for the target "${targetName}". If you can read it, the target works.`,
  };
}
