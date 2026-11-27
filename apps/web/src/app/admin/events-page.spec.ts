import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { EventDto } from '@alerts/shared';
import { EventsPage } from './events-page';

const news: EventDto = {
  id: '00000000-0000-4000-8000-0000000000e1',
  sourceId: 'news-sim',
  category: 'news',
  data: {},
  title: 'Chip maker beats estimates',
  summary: '',
  severity: 2,
  occurredAt: '2026-11-27T10:00:00.000Z',
  createdAt: '2026-11-27T10:00:00.000Z',
};

const market: EventDto = {
  id: '00000000-0000-4000-8000-0000000000e2',
  sourceId: 'market-sim',
  category: 'market',
  data: { symbol: 'ACME', price: 12, changePct: 6 },
  title: 'ACME up 6%',
  summary: '',
  severity: 3,
  occurredAt: '2026-11-27T09:00:00.000Z',
  createdAt: '2026-11-27T09:00:00.000Z',
};

// Test HTTP requests do not count toward stability, so whenStable alone can return before an async handler resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

function titles(root: HTMLElement): string[] {
  return Array.from(
    root.querySelectorAll('tbody tr td:nth-child(3)'),
    (cell) => cell.textContent?.trim() ?? '',
  );
}

describe('EventsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EventsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the newer list when an older response arrives last', async () => {
    const fixture = TestBed.createComponent(EventsPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const select = root.querySelector<HTMLSelectElement>('#events-category');
    if (!select) throw new Error('missing category select');
    select.value = 'news';
    select.dispatchEvent(new Event('change'));

    const older = http.expectOne(
      (req) => req.url === '/api/admin/events' && !req.params.has('category'),
    );
    const newer = http.expectOne(
      (req) =>
        req.url === '/api/admin/events' &&
        req.params.get('category') === 'news',
    );
    newer.flush([news]);
    await settle(fixture);
    expect(titles(root)).toEqual([news.title]);

    older.flush([news, market]);
    await settle(fixture);

    expect(titles(root)).toEqual([news.title]);
  });
});
