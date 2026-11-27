import { ChannelId, channels, type DeliveryStatus } from '@alerts/shared';

export const channelLabels = Object.fromEntries(
  ChannelId.options.map((id) => [id, channels[id].label]),
) as Record<ChannelId, string>;

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  dead: 'Dead',
  skipped: 'Skipped',
};
