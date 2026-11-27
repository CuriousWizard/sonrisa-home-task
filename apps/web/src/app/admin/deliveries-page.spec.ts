import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DeliveryStatus, type DeliveryDto } from '@alerts/shared';
import { DeliveriesPage } from './deliveries-page';

const LIST_URL = '/api/admin/deliveries?limit=200';

function delivery(index: number, status: DeliveryStatus): DeliveryDto {
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    alertId: '00000000-0000-4000-8000-0000000000a1',
    eventId: '00000000-0000-4000-8000-0000000000e1',
    targetId: '00000000-0000-4000-8000-0000000000b1',
    channel: 'slack',
    status,
    attempts: status === 'dead' ? 5 : 1,
    nextAttemptAt: '2026-11-27T10:00:00.000Z',
    lastError: status === 'failed' ? 'Slack responded 500' : null,
    sentAt: null,
    createdAt: '2026-11-27T10:00:00.000Z',
    updatedAt: '2026-11-27T10:00:00.000Z',
    eventTitle: 'Earthquake near Tokyo',
    alertName: 'Quakes',
    targetName: 'Ops channel',
    userEmail: 'user@example.local',
  };
}

const all = DeliveryStatus.options.map((status, index) =>
  delivery(index + 1, status),
);
const failed = all.find((item) => item.status === 'failed') as DeliveryDto;

// Test HTTP requests do not count toward stability, so whenStable alone can return before an async handler resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

function rowsWithRetry(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('tbody tr'))
    .filter((row) =>
      Array.from(row.querySelectorAll('button')).some(
        (button) => button.textContent?.trim() === 'Retry',
      ),
    )
    .map(
      (row) =>
        row.querySelector('[data-slot="badge"]')?.textContent?.trim() ?? '',
    );
}

function retryButton(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>('tbody button');
  if (!button) throw new Error('missing Retry button');
  return button;
}

describe('DeliveriesPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DeliveriesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(deliveries: DeliveryDto[]) {
    const fixture = TestBed.createComponent(DeliveriesPage);
    http.expectOne(LIST_URL).flush(deliveries);
    await settle(fixture);
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('shows Retry only on failed, dead and skipped rows', async () => {
    const { root } = await render(all);

    expect(root.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(rowsWithRetry(root)).toEqual(['Failed', 'Dead', 'Skipped']);
    const badges = Array.from(
      root.querySelectorAll<HTMLElement>('[data-slot="badge"]'),
    );
    const sent = badges.find((badge) => badge.textContent?.trim() === 'Sent');
    expect(sent?.classList.contains('bg-green-100')).toBe(true);
    expect(sent?.classList.contains('bg-primary')).toBe(false);
  });

  it('posts the retry and reloads the list', async () => {
    const { fixture, root } = await render([failed]);

    retryButton(root).click();
    const request = http.expectOne(`/api/admin/deliveries/${failed.id}/retry`);
    expect(request.request.method).toBe('POST');
    const pending = { ...failed, status: 'pending' as const, attempts: 0 };
    request.flush(pending);
    await settle(fixture);

    http.expectOne(LIST_URL).flush([pending]);
    await settle(fixture);

    expect(rowsWithRetry(root)).toEqual([]);
    expect(root.querySelector('[data-slot="badge"]')?.textContent?.trim()).toBe(
      'Pending',
    );
  });

  it('shows a message when the API answers 409', async () => {
    const { fixture, root } = await render([failed]);

    retryButton(root).click();
    http.expectOne(`/api/admin/deliveries/${failed.id}/retry`).flush(
      {
        statusCode: 409,
        error: 'Conflict',
        message: 'Only a failed, dead or skipped delivery can be retried',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await settle(fixture);

    expect(root.querySelector('tbody [role="status"]')?.textContent).toContain(
      'This delivery can no longer be retried.',
    );
    http.expectNone(LIST_URL);
  });

  it('keeps the newer list when an older response arrives last', async () => {
    const fixture = TestBed.createComponent(DeliveriesPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const select = root.querySelector<HTMLSelectElement>('#deliveries-status');
    if (!select) throw new Error('missing status select');
    select.value = 'failed';
    select.dispatchEvent(new Event('change'));

    const older = http.expectOne(LIST_URL);
    const newer = http.expectOne(
      (req) =>
        req.url === '/api/admin/deliveries' &&
        req.params.get('status') === 'failed',
    );
    newer.flush([failed]);
    await settle(fixture);
    older.flush(all);
    await settle(fixture);

    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(
      root.querySelector(
        'button[aria-label="Retry delivery for Earthquake near Tokyo to Ops channel"]',
      ),
    ).not.toBeNull();
  });
});
