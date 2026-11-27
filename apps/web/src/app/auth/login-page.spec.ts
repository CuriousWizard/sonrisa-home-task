import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPage } from './login-page';

function type(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`missing ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('LoginPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows the server message when login returns 401', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    type(root, '#email', 'user@example.local');
    type(root, '#password', 'wrong-password');
    root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    const request = http.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({
      email: 'user@example.local',
      password: 'wrong-password',
    });
    request.flush(
      {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid email or password',
    );
  });
});
