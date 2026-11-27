import { Component, inject, signal } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AuthStore } from '../core/auth.store';

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HlmButtonImports],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly userLinks: NavLink[] = [
    { path: '/alerts', label: 'Alerts' },
    { path: '/targets', label: 'Targets' },
  ];
  protected readonly adminLinks: NavLink[] = [
    { path: '/admin/users', label: 'Users' },
    { path: '/admin/events', label: 'Events' },
    { path: '/admin/deliveries', label: 'Deliveries' },
    { path: '/admin/settings', label: 'Settings' },
    { path: '/admin/metrics', label: 'Metrics' },
  ];
  protected readonly signOutError = signal<string | null>(null);

  protected async signOut(): Promise<void> {
    this.signOutError.set(null);
    try {
      await this.auth.logout();
    } catch {
      this.signOutError.set('Sign-out failed. Try again.');
      return;
    }
    await this.router.navigateByUrl('/login');
  }
}
