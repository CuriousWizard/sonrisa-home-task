import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { UserDto } from '@alerts/shared';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthStore, ME_URL } from './auth.store';

const user: UserDto = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'user@example.local',
  role: 'user',
};

const unauthorized = {
  body: { statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' },
  init: { status: 401, statusText: 'Unauthorized' },
};

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let store: AuthStore;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const loading = store.load();
    http.expectOne(ME_URL).flush(user);
    await loading;
  });

  afterEach(() => http.verify());

  it('clears the store and goes to /login on a 401 from /api/alerts', async () => {
    const request = firstValueFrom(client.get('/api/alerts'));
    http.expectOne('/api/alerts').flush(unauthorized.body, unauthorized.init);

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(store.user()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('leaves the store and the page alone on a 401 from /api/auth/me', async () => {
    const request = firstValueFrom(client.get(ME_URL));
    http.expectOne(ME_URL).flush(unauthorized.body, unauthorized.init);

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(store.user()).toEqual(user);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
