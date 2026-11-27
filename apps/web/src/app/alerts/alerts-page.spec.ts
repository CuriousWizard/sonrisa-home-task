import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AlertDto } from '@alerts/shared';
import { AlertsPage } from './alerts-page';

const alert: AlertDto = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Quakes',
  category: 'disaster',
  filters: { types: ['earthquake'], regions: [], minMagnitude: 6 },
  minSeverity: 3,
  targetIds: ['00000000-0000-4000-8000-00000000000a'],
  enabled: true,
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
};

describe('AlertsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlertsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends PATCH with the new value when the switch is turned off', async () => {
    const fixture = TestBed.createComponent(AlertsPage);
    http.expectOne('/api/alerts?limit=200').flush([alert]);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>(
      'button[role="switch"]',
    );
    if (!toggle) throw new Error('missing switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    toggle.click();
    const request = http.expectOne(`/api/alerts/${alert.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ enabled: false });
    request.flush({ ...alert, enabled: false });
    await fixture.whenStable();

    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('shows one sentence and the New alert link when there are no alerts', async () => {
    const fixture = TestBed.createComponent(AlertsPage);
    http.expectOne('/api/alerts?limit=200').flush([]);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('You have no alerts yet.');
    expect(
      root.querySelector('a[href="/alerts/new"]')?.textContent?.trim(),
    ).toBe('New alert');
    expect(root.querySelector('table')).toBeNull();
  });
});
