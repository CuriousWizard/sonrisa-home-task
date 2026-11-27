import type { Config } from '../config';
import { createDisasterSource } from './simulated/disaster';
import { createMarketSource } from './simulated/market';
import { createNewsSource } from './simulated/news';
import type { EventSource } from './source';

export function createSourceRegistry(
  config: Pick<Config, 'SOURCE_MIN_INTERVAL_MS' | 'SOURCE_MAX_INTERVAL_MS'>,
): readonly EventSource[] {
  const options = {
    minIntervalMs: config.SOURCE_MIN_INTERVAL_MS,
    maxIntervalMs: config.SOURCE_MAX_INTERVAL_MS,
  };
  return [
    createNewsSource(options),
    createMarketSource(options),
    createDisasterSource(options),
  ];
}
