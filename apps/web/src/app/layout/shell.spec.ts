import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { UserDto } from '@alerts/shared';
import { AuthStore } from '../core/auth.store';
import { Shell } from './shell';

const user: UserDto = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'user@example.local',
  role: 'user',
};

// Test HTTP requests do not count toward stability, so whenStable alone can return before signOut() resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('Shell sign-out', () => {
  let http: HttpTestingController;
  let store: AuthStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    const loading = store.load();
    http.expectOne('/api/auth/me').flush(user);
    await loading;
  });

  afterEach(() => http.verify());

  async function signOut(status: number) {
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = Array.from(root.querySelectorAll('button')).find(
      (element) => element.textContent?.trim() === 'Sign out',
    );
    if (!button) throw new Error('missing Sign out button');

    button.click();
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST');
    if (status === 204) {
      request.flush(null, { status, statusText: 'No Content' });
    } else {
      request.flush(
        { statusCode: status, error: 'Error', message: 'Error' },
        { status, statusText: 'Error' },
      );
    }
    await settle(fixture);
    return { root, navigate };
  }

  it('clears the user and goes to /login when logout succeeds', async () => {
    const { navigate } = await signOut(204);

    expect(store.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('clears the user and goes to /login when logout returns 401', async () => {
    const { navigate } = await signOut(401);

    expect(store.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('keeps the user, stays and shows an error when logout returns 500', async () => {
    const { root, navigate } = await signOut(500);

    expect(store.user()).toEqual(user);
    expect(navigate).not.toHaveBeenCalled();
    expect(root.querySelector('header [role="alert"]')?.textContent).toBe(
      'Sign-out failed. Try again.',
    );
  });
});
