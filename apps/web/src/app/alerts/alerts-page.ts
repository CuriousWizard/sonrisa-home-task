import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AlertDto } from '@alerts/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { AlertsApi } from '../core/alerts.api';
import { serverMessage } from '../core/errors';
import { PageHeader } from '../layout/page-header';
import { categoryLabels, summarizeFilters } from './alert-form';

@Component({
  selector: 'app-alerts-page',
  imports: [
    RouterLink,
    PageHeader,
    HlmButtonImports,
    HlmSwitchImports,
    HlmTableImports,
  ],
  templateUrl: './alerts-page.html',
})
export class AlertsPage {
  private readonly api = inject(AlertsApi);

  protected readonly categoryLabels = categoryLabels;
  protected readonly alerts = signal<AlertDto[] | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly rows = computed(() =>
    (this.alerts() ?? []).map((alert) => ({
      alert,
      summary: summarizeFilters(alert),
    })),
  );
  protected readonly rowErrors = signal<Record<string, string>>({});
  protected readonly confirmingDelete = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async setEnabled(alert: AlertDto, enabled: boolean): Promise<void> {
    this.setRowError(alert.id, null);
    // The row shows the new value at once and goes back to the old one if the request fails.
    this.replace({ ...alert, enabled });
    try {
      this.replace(await this.api.setEnabled(alert.id, enabled));
    } catch (error) {
      this.replace(alert);
      this.setRowError(alert.id, serverMessage(error));
    }
  }

  protected async remove(alert: AlertDto): Promise<void> {
    if (this.confirmingDelete() !== alert.id) {
      this.confirmingDelete.set(alert.id);
      return;
    }
    this.confirmingDelete.set(null);
    this.setRowError(alert.id, null);
    try {
      await this.api.remove(alert.id);
      this.alerts.update(
        (list) => list?.filter((item) => item.id !== alert.id) ?? null,
      );
    } catch (error) {
      this.setRowError(alert.id, serverMessage(error));
    }
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  private async load(): Promise<void> {
    try {
      this.alerts.set(await this.api.list());
    } catch (error) {
      this.loadError.set(serverMessage(error));
    }
  }

  private replace(alert: AlertDto): void {
    this.alerts.update(
      (list) =>
        list?.map((item) => (item.id === alert.id ? alert : item)) ?? null,
    );
  }

  private setRowError(id: string, message: string | null): void {
    this.rowErrors.update((errors) => {
      const next = { ...errors };
      if (message) {
        next[id] = message;
      } else {
        delete next[id];
      }
      return next;
    });
  }
}
