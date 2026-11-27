import { DisasterType, Region } from '@alerts/shared';
import { regionName } from '../../delivery/message';
import { earthquakeSeverity } from '../../matching/severity';
import type { EventSource, SimulatorOptions } from '../source';
import { createSimulator, pick, randomInt, round } from './simulator';

const TITLES: Record<Exclude<DisasterType, 'earthquake'>, string> = {
  flood: 'Flooding reported in',
  storm: 'Storm warning issued for',
  wildfire: 'Wildfire spreads in',
};

const MIN_MAGNITUDE = 4;
const MAGNITUDE_RANGE = 5;

export function createDisasterSource(options: SimulatorOptions): EventSource {
  return createSimulator('disaster-sim', 'disaster', options, (random) => {
    const type = pick(random, DisasterType.options);
    const region = pick(random, Region.options);
    const place = regionName(region);
    if (type === 'earthquake') {
      const magnitude = round(MIN_MAGNITUDE + random() * MAGNITUDE_RANGE, 1);
      return {
        category: 'disaster',
        title: `Magnitude ${magnitude} earthquake in ${place}`,
        summary: 'Seismologists are assessing aftershock risk.',
        severity: earthquakeSeverity(magnitude),
        data: { type, region, magnitude },
      };
    }
    return {
      category: 'disaster',
      title: `${TITLES[type]} ${place}`,
      summary: 'Local authorities are assessing the damage.',
      severity: randomInt(random, 1, 5),
      data: { type, region },
    };
  });
}
