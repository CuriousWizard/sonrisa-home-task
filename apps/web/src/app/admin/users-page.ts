import { Component, computed, inject, signal } from '@angular/core';
import type { AdminUserDto, AlertDto } from '@alerts/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { categoryLabels, summarizeFilters } from '../alerts/alert-form';
import { AdminApi } from '../core/admin.api';
import { serverMessage } from '../core/errors';
import { LocalDateTimePipe } from '../layout/local-date-time.pipe';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-users-page',
  imports: [PageHeader, LocalDateTimePipe, HlmButtonImports, HlmTableImports],
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly api = inject(AdminApi);

  protected readonly categoryLabels = categoryLabels;
  protected readonly users = signal<AdminUserDto[] | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly selected = signal<AdminUserDto | null>(null);
  protected readonly alerts = signal<AlertDto[] | null>(null);
  protected readonly alertsError = signal<string | null>(null);
  protected readonly alertRows = computed(() =>
    (this.alerts() ?? []).map((alert) => ({
      alert,
      summary: summarizeFilters(alert),
    })),
  );

  constructor() {
    void this.load();
  }

  protected async select(user: AdminUserDto): Promise<void> {
    this.selected.set(user);
    this.alerts.set(null);
    this.alertsError.set(null);
    try {
      const alerts = await this.api.alerts(user.id);
      // A later click on another user wins over this response.
      if (this.selected()?.id === user.id) this.alerts.set(alerts);
    } catch (error) {
      if (this.selected()?.id === user.id) {
        this.alertsError.set(serverMessage(error));
      }
    }
  }

  private async load(): Promise<void> {
    try {
      this.users.set(await this.api.users());
    } catch (error) {
      this.loadError.set(serverMessage(error));
    }
  }
}
