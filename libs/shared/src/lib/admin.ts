import { z } from 'zod';
import { ListQuery } from './common';
import { ChannelId } from './channels';
import { Category, DeliveryStatus } from './enums';
import { UserDto } from './auth';

export const AdminAlertsQuery = z.object({ userId: z.uuid() });
export type AdminAlertsQuery = z.infer<typeof AdminAlertsQuery>;

export const AdminEventsQuery = ListQuery.extend({
  category: Category.optional(),
});
export type AdminEventsQuery = z.infer<typeof AdminEventsQuery>;

export const AdminDeliveriesQuery = ListQuery.extend({
  status: DeliveryStatus.optional(),
  channel: ChannelId.optional(),
});
export type AdminDeliveriesQuery = z.infer<typeof AdminDeliveriesQuery>;

export type AdminUserDto = UserDto & { createdAt: string; alertCount: number };

export interface DeliveryDto {
  id: string;
  alertId: string;
  eventId: string;
  targetId: string;
  channel: ChannelId;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  eventTitle: string;
  alertName: string;
  targetName: string;
  userEmail: string;
}

export interface SourceDto {
  id: string;
  category: Category;
  enabled: boolean;
  updatedAt: string;
}

export interface ChannelDto {
  id: ChannelId;
  enabled: boolean;
  updatedAt: string;
}

export interface MetricsDto {
  since: string;
  eventsByCategory: Record<Category, number>;
  deliveriesByStatus: Record<DeliveryStatus, number>;
  failureRateByChannel: Record<ChannelId, number>;
}
