import type { Route } from '@angular/router';
import { LoginPage } from './auth/login-page';
import { RegisterPage } from './auth/register-page';
import { adminGuard, authGuard } from './core/auth.guards';
import { Shell } from './layout/shell';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage, title: 'Sign in' },
  { path: 'register', component: RegisterPage, title: 'Create an account' },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'alerts' },
      {
        path: 'alerts',
        title: 'Alerts',
        loadComponent: () =>
          import('./alerts/alerts-page').then((m) => m.AlertsPage),
      },
      {
        path: 'alerts/new',
        title: 'New alert',
        loadComponent: () =>
          import('./alerts/alert-form-page').then((m) => m.AlertFormPage),
      },
      {
        path: 'alerts/:id',
        title: 'Edit alert',
        loadComponent: () =>
          import('./alerts/alert-form-page').then((m) => m.AlertFormPage),
      },
      {
        path: 'targets',
        title: 'Targets',
        loadComponent: () =>
          import('./targets/targets-page').then((m) => m.TargetsPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          {
            path: 'users',
            title: 'Users',
            loadComponent: () =>
              import('./admin/users-page').then((m) => m.UsersPage),
          },
          {
            path: 'events',
            title: 'Events',
            loadComponent: () =>
              import('./admin/events-page').then((m) => m.EventsPage),
          },
          {
            path: 'deliveries',
            title: 'Deliveries',
            loadComponent: () =>
              import('./admin/deliveries-page').then((m) => m.DeliveriesPage),
          },
          {
            path: 'settings',
            title: 'Settings',
            loadComponent: () =>
              import('./admin/settings-page').then((m) => m.SettingsPage),
          },
          {
            path: 'metrics',
            title: 'Metrics',
            loadComponent: () =>
              import('./admin/metrics-page').then((m) => m.MetricsPage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'alerts' },
];
