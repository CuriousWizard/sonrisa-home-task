import type { Route } from '@angular/router';
import { appRoutes } from './app.routes';
import { adminGuard, authGuard } from './core/auth.guards';

// Maps each full path that renders a page to the canActivate guards it inherits. Redirects run no guards.
function guardsByPath(
  routes: Route[],
  parentPath = '',
  parentGuards: unknown[] = [],
): Map<string, unknown[]> {
  const result = new Map<string, unknown[]>();
  for (const route of routes) {
    if (route.redirectTo !== undefined) continue;
    const path = [parentPath, route.path].filter(Boolean).join('/');
    const guards = [...parentGuards, ...(route.canActivate ?? [])];
    if (route.children) {
      for (const entry of guardsByPath(route.children, path, guards)) {
        result.set(...entry);
      }
    } else {
      result.set(path, guards);
    }
  }
  return result;
}

const publicPaths = ['login', 'register'];
const signedInPaths = ['alerts', 'alerts/new', 'alerts/:id', 'targets'];
const adminPaths = [
  'admin/users',
  'admin/events',
  'admin/deliveries',
  'admin/settings',
  'admin/metrics',
];

describe('appRoutes', () => {
  const guards = guardsByPath(appRoutes);

  it('lists every page route', () => {
    expect([...guards.keys()].sort()).toEqual(
      [...publicPaths, ...signedInPaths, ...adminPaths].sort(),
    );
  });

  it('leaves only the sign-in and register pages unguarded', () => {
    for (const path of publicPaths) {
      expect(guards.get(path), path).toEqual([]);
    }
  });

  it.each([...signedInPaths, ...adminPaths])(
    'guards %s with authGuard',
    (path) => {
      expect(guards.get(path)).toContain(authGuard);
    },
  );

  it.each(adminPaths)('guards %s with adminGuard', (path) => {
    expect(guards.get(path)).toContain(adminGuard);
  });

  it.each(signedInPaths)('does not guard %s with adminGuard', (path) => {
    expect(guards.get(path)).not.toContain(adminGuard);
  });
});
