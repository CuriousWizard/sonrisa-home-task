import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { MetricsDto } from '@alerts/shared';
import { MetricsPage } from './metrics-page';

const metrics: MetricsDto = {
  since: '2026-11-26T10:00:00.000Z',
  eventsByCategory: { news: 4, market: 7, disaster: 2 },
  deliveriesByStatus: {
    pending: 0,
    sending: 0,
    sent: 7,
    failed: 1,
    dead: 1,
    skipped: 0,
  },
  failureRateByChannel: { email: 0.125, slack: 0 },
};

// Test HTTP requests do not count toward stability, so whenStable alone can return before an async handler resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

function valueOf(root: HTMLElement, label: string): string | undefined {
  const term = Array.from(root.querySelectorAll('dt')).find(
    (element) => element.textContent?.trim() === label,
  );
  return term?.nextElementSibling?.textContent?.trim();
}

describe('MetricsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MetricsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows a failure rate of 0.125 as 12.5%', async () => {
    const fixture = TestBed.createComponent(MetricsPage);
    http.expectOne('/api/admin/metrics').flush(metrics);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(valueOf(root, 'Email')).toBe('12.5%');
    expect(valueOf(root, 'Slack')).toBe('0.0%');
    expect(valueOf(root, 'Market')).toBe('7');
    expect(root.querySelector('time')?.getAttribute('datetime')).toBe(
      metrics.since,
    );
  });
});
