import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
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

// Test HTTP requests do not count toward stability, so whenStable alone can return before an async handler resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

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

  async function render() {
    const fixture = TestBed.createComponent(AlertsPage);
    http.expectOne('/api/alerts?limit=200').flush([alert]);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>(
      'button[role="switch"][aria-label="Quakes enabled"]',
    );
    if (!toggle) throw new Error('missing switch');
    return { fixture, root, toggle };
  }

  it('puts the switch back on and shows the error when PATCH fails', async () => {
    const { fixture, root, toggle } = await render();

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    http.expectOne(`/api/alerts/${alert.id}`).flush(
      {
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Database unavailable',
      },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await settle(fixture);

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('tbody [role="status"]')?.textContent).toContain(
      'Database unavailable',
    );
  });

  it('disables the switch until PATCH answers', async () => {
    const { fixture, toggle } = await render();
    expect(toggle.disabled).toBe(false);

    toggle.click();
    await fixture.whenStable();
    expect(toggle.disabled).toBe(true);
    toggle.click();
    await fixture.whenStable();
    http
      .expectOne(`/api/alerts/${alert.id}`)
      .flush({ ...alert, enabled: false });
    await settle(fixture);

    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

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
