import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { TargetDto } from '@alerts/shared';
import { TargetsPage } from './targets-page';

const LIST_URL = '/api/targets?limit=200';

const target: TargetDto = {
  id: '00000000-0000-4000-8000-00000000000a',
  name: 'Ops channel',
  channel: 'slack',
  config: { webhookUrl: 'https://hooks.slack.com/services/T000/B000/secret' },
  createdAt: '2026-11-27T10:00:00.000Z',
};

function inputByLabel(
  root: HTMLElement,
  text: string,
): HTMLInputElement | null {
  const label = Array.from(root.querySelectorAll('label')).find(
    (element) => element.textContent?.trim() === text,
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector<HTMLInputElement>(`#${id}`) : null;
}

function button(root: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === text,
  );
  if (!found) throw new Error(`missing button ${text}`);
  return found;
}

describe('TargetsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TargetsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(targets: TargetDto[]) {
    const fixture = TestBed.createComponent(TargetsPage);
    http.expectOne(LIST_URL).flush(targets);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('shows the config inputs of the chosen channel from the shared map', async () => {
    const { fixture, root } = await render([]);
    const select = root.querySelector<HTMLSelectElement>('#target-channel');
    if (!select) throw new Error('missing channel select');

    select.value = 'slack';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(inputByLabel(root, 'Webhook URL')?.type).toBe('url');
    expect(inputByLabel(root, 'Email address')).toBeNull();

    select.value = 'email';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(inputByLabel(root, 'Email address')?.type).toBe('email');
    expect(inputByLabel(root, 'Webhook URL')).toBeNull();
  });

  it('shows only the host of a Slack webhook URL', async () => {
    const { root } = await render([target]);

    expect(root.querySelector('tbody')?.textContent).toContain(
      'hooks.slack.com',
    );
    expect(root.querySelector('tbody')?.textContent).not.toContain('secret');
  });

  it('shows the Slack allowlist rejection under the config fields', async () => {
    const { fixture, root } = await render([]);
    const select = root.querySelector<HTMLSelectElement>('#target-channel');
    if (!select) throw new Error('missing channel select');
    select.value = 'slack';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const name = inputByLabel(root, 'Name');
    const webhook = inputByLabel(root, 'Webhook URL');
    if (!name || !webhook) throw new Error('missing target inputs');
    name.value = 'Team';
    name.dispatchEvent(new Event('input'));
    webhook.value = 'https://example.com/hook';
    webhook.dispatchEvent(new Event('input'));
    button(root, 'Add target').click();

    const request = http.expectOne('/api/targets');
    expect(request.request.method).toBe('POST');
    request.flush(
      {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Webhook URL is not on the allowed list',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    const message = root.querySelector('#target-config-error');
    expect(message?.textContent).toContain(
      'Webhook URL is not on the allowed list',
    );
    expect(message?.closest('[formgroupname="config"]')).not.toBeNull();
    expect(webhook.getAttribute('aria-describedby')).toContain(
      'target-config-error',
    );
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('turns Delete into Confirm delete on the same focused button, and Escape or blur cancels', async () => {
    const { fixture, root } = await render([target]);
    const remove = button(root, 'Delete');
    expect(remove.getAttribute('aria-label')).toBe('Delete target Ops channel');

    remove.focus();
    remove.click();
    await fixture.whenStable();
    expect(button(root, 'Confirm delete')).toBe(remove);
    expect(remove.getAttribute('aria-label')).toBe(
      'Confirm delete target Ops channel',
    );
    expect(remove.classList.contains('text-destructive')).toBe(true);
    expect(document.activeElement).toBe(remove);

    remove.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(remove.textContent?.trim()).toBe('Delete');
    expect(remove.classList.contains('text-destructive')).toBe(false);

    remove.click();
    await fixture.whenStable();
    expect(remove.textContent?.trim()).toBe('Confirm delete');
    remove.blur();
    await fixture.whenStable();
    expect(remove.textContent?.trim()).toBe('Delete');
    http.expectNone(`/api/targets/${target.id}`);
  });

  it('asks for a second click and shows the 409 message on delete', async () => {
    const { fixture, root } = await render([target]);

    button(root, 'Delete').click();
    await fixture.whenStable();
    http.expectNone(`/api/targets/${target.id}`);

    button(root, 'Confirm delete').click();
    const request = http.expectOne(`/api/targets/${target.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(
      {
        statusCode: 409,
        error: 'Conflict',
        message: 'An alert still uses this target',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    expect(root.querySelector('tbody')?.textContent).toContain(
      'An alert still uses this target.',
    );
    expect(root.querySelector('tbody')?.textContent).toContain('Ops channel');
  });
});
