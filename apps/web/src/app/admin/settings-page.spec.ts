import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ChannelDto, SourceDto } from '@alerts/shared';
import { SettingsPage } from './settings-page';

const sources: SourceDto[] = [
  {
    id: 'news-sim',
    category: 'news',
    enabled: true,
    updatedAt: '2026-11-27T10:00:00.000Z',
  },
];

const channels: ChannelDto[] = [
  { id: 'email', enabled: true, updatedAt: '2026-11-27T10:00:00.000Z' },
  { id: 'slack', enabled: false, updatedAt: '2026-11-27T10:00:00.000Z' },
];

// Test HTTP requests do not count toward stability, so whenStable alone can return before an async handler resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('SettingsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('puts the switch back and shows the error when PATCH fails', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    http.expectOne('/api/admin/sources').flush(sources);
    http.expectOne('/api/admin/channels').flush(channels);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>(
      'button[role="switch"][aria-label="email enabled"]',
    );
    if (!toggle) throw new Error('missing email switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    const request = http.expectOne('/api/admin/channels/email');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ enabled: false });
    request.flush(
      {
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Database unavailable',
      },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await settle(fixture);

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'Database unavailable',
    );
  });
});
