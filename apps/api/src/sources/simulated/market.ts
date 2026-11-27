import { marketSeverity } from '../../matching/severity';
import type { EventSource, SimulatorOptions } from '../source';
import { createSimulator, pick, round } from './simulator';

const STOCKS = [
  { symbol: 'AAPL', price: 230 },
  { symbol: 'MSFT', price: 450 },
  { symbol: 'TSLA', price: 250 },
  { symbol: 'NVDA', price: 140 },
  { symbol: 'AMZN', price: 200 },
  { symbol: 'GOOGL', price: 180 },
] as const;

const MAX_MOVE_PCT = 25;

export function createMarketSource(options: SimulatorOptions): EventSource {
  return createSimulator('market-sim', 'market', options, (random) => {
    const stock = pick(random, STOCKS);
    // Cubing a uniform value makes most moves small, so high severity stays rare.
    const size = Math.max(0.01, round(random() ** 3 * MAX_MOVE_PCT, 2));
    const changePct = random() < 0.5 ? -size : size;
    const price = round(stock.price * (1 + changePct / 100), 2);
    return {
      category: 'market',
      title: `${stock.symbol} ${changePct > 0 ? 'rises' : 'falls'} ${size}%`,
      summary: `${stock.symbol} trades at ${price}.`,
      severity: marketSeverity(changePct),
      data: { symbol: stock.symbol, price, changePct },
    };
  });
}
