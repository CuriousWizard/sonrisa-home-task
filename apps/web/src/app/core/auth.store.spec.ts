import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { UserDto } from '@alerts/shared';
import { AuthStore } from './auth.store';

const admin: UserDto = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.local',
  role: 'admin',
};

describe('AuthStore', () => {
  let store: AuthStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the user when me succeeds and calls me only once', async () => {
    const loading = store.load();
    http.expectOne('/api/auth/me').flush(admin);

    await expect(loading).resolves.toEqual(admin);
    expect(store.user()).toEqual(admin);
    expect(store.isAdmin()).toBe(true);
    await expect(store.load()).resolves.toEqual(admin);
  });

  it('has no user when me returns 401', async () => {
    const loading = store.load();
    http
      .expectOne('/api/auth/me')
      .flush(
        { statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expect(loading).resolves.toBeNull();
    expect(store.user()).toBeNull();
    expect(store.isAdmin()).toBe(false);
  });

  it('clears the user on logout', async () => {
    const loading = store.load();
    http.expectOne('/api/auth/me').flush(admin);
    await loading;

    const loggingOut = store.logout();
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await loggingOut;

    expect(store.user()).toBeNull();
    expect(store.isAdmin()).toBe(false);
    await expect(store.load()).resolves.toBeNull();
  });
});
