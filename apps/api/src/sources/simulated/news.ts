import type { EventSource, SimulatorOptions } from '../source';
import { createSimulator, pick, randomInt } from './simulator';

const HEADLINES = [
  {
    title: 'Oil prices climb as supply talks stall',
    summary: 'Producers ended the meeting without a deal on output.',
  },
  {
    title: 'Central bank keeps interest rates unchanged',
    summary: 'The bank said inflation is close to its target.',
  },
  {
    title: 'Chip maker plans a new factory in Europe',
    summary: 'The plant would open in three years and employ 2,000 people.',
  },
  {
    title: 'Port strike ends after two weeks',
    summary: 'Shipping lines expect the delays to clear within days.',
  },
  {
    title: 'Regulators open an inquiry into cloud pricing',
    summary: 'The inquiry covers the three largest providers.',
  },
  {
    title: 'Election results delayed by a recount',
    summary: 'Officials expect final numbers by the end of the week.',
  },
] as const;

export function createNewsSource(options: SimulatorOptions): EventSource {
  return createSimulator('news-sim', 'news', options, (random) => {
    const severity = randomInt(random, 1, 5);
    const headline = pick(random, HEADLINES);
    return {
      category: 'news',
      title: severity >= 4 ? `Breaking: ${headline.title}` : headline.title,
      summary: headline.summary,
      severity,
      data: {},
    };
  });
}
