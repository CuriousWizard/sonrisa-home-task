import { z } from 'zod';

export const Category = z.enum(['news', 'market', 'disaster']);
export type Category = z.infer<typeof Category>;

export const Region = z.enum([
  'africa',
  'asia',
  'europe',
  'north-america',
  'south-america',
  'oceania',
]);
export type Region = z.infer<typeof Region>;

export const Severity = z.int().min(1).max(5);
export type Severity = z.infer<typeof Severity>;

export const DisasterType = z.enum([
  'earthquake',
  'flood',
  'storm',
  'wildfire',
]);
export type DisasterType = z.infer<typeof DisasterType>;

export const Role = z.enum(['user', 'admin']);
export type Role = z.infer<typeof Role>;

export const DeliveryStatus = z.enum([
  'pending',
  'sending',
  'sent',
  'failed',
  'dead',
  'skipped',
]);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;
