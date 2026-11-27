import type { Category, ChannelId } from '@alerts/shared';
import type { Db } from './client';
import { channels, sources } from './schema';

export interface RegistryRows {
  channelIds: readonly ChannelId[];
  sources: readonly { id: string; category: Category }[];
}

// "On conflict do nothing" keeps every switch the admin has already set.
export async function syncRegistryRows(
  db: Db,
  registry: RegistryRows,
): Promise<void> {
  if (registry.channelIds.length > 0) {
    await db
      .insert(channels)
      .values(registry.channelIds.map((id) => ({ id, enabled: true })))
      .onConflictDoNothing();
  }
  if (registry.sources.length > 0) {
    await db
      .insert(sources)
      .values(
        registry.sources.map(({ id, category }) => ({
          id,
          category,
          enabled: true,
        })),
      )
      .onConflictDoNothing();
  }
}
