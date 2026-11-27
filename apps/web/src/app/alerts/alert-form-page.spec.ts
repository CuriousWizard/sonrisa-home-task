import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { AlertDto, TargetDto } from '@alerts/shared';
import { AlertFormPage } from './alert-form-page';

const TARGETS_URL = '/api/targets?limit=200';

const target: TargetDto = {
  id: '00000000-0000-4000-8000-00000000000a',
  name: 'Ops mail',
  channel: 'email',
  config: { address: 'ops@example.local' },
  createdAt: '2026-11-27T10:00:00.000Z',
};

const alert: AlertDto = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Quakes',
  category: 'disaster',
  filters: { types: ['earthquake'], regions: ['asia'], minMagnitude: 6 },
  minSeverity: 3,
  targetIds: [target.id],
  enabled: false,
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
};

// Test HTTP requests do not count toward stability, so whenStable alone can return before load() resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

function field<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`missing ${selector}`);
  return element;
}

function type(root: HTMLElement, selector: string, value: string): void {
  const input = field<HTMLInputElement>(root, selector);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function choose(root: HTMLElement, selector: string, value: string): void {
  const select = field<HTMLSelectElement>(root, selector);
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('AlertFormPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlertFormPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function spyOnNavigate() {
    return vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
  }

  it('posts a market alert built from the form', async () => {
    const navigate = spyOnNavigate();
    const fixture = TestBed.createComponent(AlertFormPage);
    await fixture.whenStable();
    http.expectOne(TARGETS_URL).flush([target]);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    type(root, '#alert-name', 'Drops');
    choose(root, '#alert-category', 'market');
    await fixture.whenStable();
    type(root, '#alert-symbols', 'AAPL, , msft');
    choose(root, '#alert-direction', 'down');
    type(root, '#alert-min-change', '5');
    field<HTMLInputElement>(root, `#alert-target-${target.id}`).click();
    field<HTMLButtonElement>(root, 'button[type="submit"]').click();

    const request = http.expectOne('/api/alerts');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Drops',
      category: 'market',
      filters: {
        symbols: ['AAPL', 'msft'],
        direction: 'down',
        minChangePct: 5,
      },
      minSeverity: 1,
      targetIds: [target.id],
      enabled: true,
    });
    request.flush({ ...alert, ...request.request.body });
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith('/alerts');
  });

  it('shows the target error and sends nothing without a target', async () => {
    const fixture = TestBed.createComponent(AlertFormPage);
    await fixture.whenStable();
    http.expectOne(TARGETS_URL).flush([target]);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    type(root, '#alert-name', 'News');
    field<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await fixture.whenStable();

    expect(field(root, '#alert-targets-error').textContent).toContain(
      'Choose from 1 to 20 targets.',
    );
  });

  it('resets the filter fields when the category changes', async () => {
    const fixture = TestBed.createComponent(AlertFormPage);
    await fixture.whenStable();
    http.expectOne(TARGETS_URL).flush([target]);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    choose(root, '#alert-category', 'market');
    await fixture.whenStable();
    type(root, '#alert-symbols', 'AAPL');
    choose(root, '#alert-category', 'news');
    await fixture.whenStable();
    choose(root, '#alert-category', 'market');
    await fixture.whenStable();

    expect(field<HTMLInputElement>(root, '#alert-symbols').value).toBe('');
  });

  it('loads an alert and sends PUT with its values', async () => {
    const navigate = spyOnNavigate();
    const fixture = TestBed.createComponent(AlertFormPage);
    fixture.componentRef.setInput('id', alert.id);
    await fixture.whenStable();
    http.expectOne(TARGETS_URL).flush([target]);
    http.expectOne(`/api/alerts/${alert.id}`).flush(alert);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(field<HTMLInputElement>(root, '#alert-name').value).toBe('Quakes');
    expect(field<HTMLSelectElement>(root, '#alert-category').value).toBe(
      'disaster',
    );
    expect(
      field<HTMLInputElement>(root, '#alert-type-earthquake').checked,
    ).toBe(true);
    expect(field<HTMLInputElement>(root, '#alert-region-asia').checked).toBe(
      true,
    );
    field<HTMLButtonElement>(root, 'button[type="submit"]').click();

    const request = http.expectOne(`/api/alerts/${alert.id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      name: alert.name,
      category: alert.category,
      filters: alert.filters,
      minSeverity: alert.minSeverity,
      targetIds: alert.targetIds,
      enabled: alert.enabled,
    });
    request.flush(alert);
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith('/alerts');
  });

  it('keeps target ids that are not in the target list in the PUT body', async () => {
    const unlisted = '00000000-0000-4000-8000-00000000000b';
    spyOnNavigate();
    const fixture = TestBed.createComponent(AlertFormPage);
    fixture.componentRef.setInput('id', alert.id);
    await fixture.whenStable();
    http.expectOne(TARGETS_URL).flush([target]);
    http
      .expectOne(`/api/alerts/${alert.id}`)
      .flush({ ...alert, targetIds: [target.id, unlisted] });
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(field(root, '#alert-unlisted-targets').textContent).toContain(
      'Also sends to 1 target not listed here.',
    );
    field<HTMLButtonElement>(root, 'button[type="submit"]').click();

    const request = http.expectOne(`/api/alerts/${alert.id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.targetIds).toEqual([target.id, unlisted]);
    request.flush(alert);
    await settle(fixture);
  });

  it('links to the targets page when the user has no targets', async () => {
    const fixture = TestBed.createComponent(AlertFormPage);
    await fixture.whenStable();
    http.expectOne(TARGETS_URL).flush([]);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('form')).toBeNull();
    expect(field(root, 'a[href="/targets"]').textContent?.trim()).toBe(
      'target',
    );
  });
});
