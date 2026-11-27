import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import type { UserDto } from '@alerts/shared';
import { adminGuard, authGuard } from './auth.guards';
import { AuthStore } from './auth.store';

const user: UserDto = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'user@example.local',
  role: 'user',
};
const admin: UserDto = { ...user, email: 'admin@example.local', role: 'admin' };

async function runGuard(
  guard: CanActivateFn,
  current: UserDto | null,
): Promise<true | string> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { load: async () => current } },
    ],
  });
  const result = await TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  if (result instanceof UrlTree) {
    return TestBed.inject(Router).serializeUrl(result);
  }
  if (result !== true) {
    throw new Error(`unexpected guard result ${String(result)}`);
  }
  return result;
}

describe('authGuard', () => {
  it('allows a signed-in user', async () => {
    expect(await runGuard(authGuard, user)).toBe(true);
  });

  it('sends a signed-out user to /login', async () => {
    expect(await runGuard(authGuard, null)).toBe('/login');
  });
});

describe('adminGuard', () => {
  it('allows an admin', async () => {
    expect(await runGuard(adminGuard, admin)).toBe(true);
  });

  it('sends a non-admin to /alerts', async () => {
    expect(await runGuard(adminGuard, user)).toBe('/alerts');
  });
});
