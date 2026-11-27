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
  // Alerts with a PATCH in flight. Their switch is disabled so a second toggle cannot race the first.
  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  protected readonly confirmingDelete = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async setEnabled(alert: AlertDto, enabled: boolean): Promise<void> {
    this.setRowError(alert.id, null);
    this.setSaving(alert.id, true);
    // The row shows the new value at once and goes back to the old one if the request fails.
    this.replace({ ...alert, enabled });
    try {
      this.replace(await this.api.setEnabled(alert.id, enabled));
    } catch (error) {
      this.replace(alert);
      this.setRowError(alert.id, serverMessage(error));
    } finally {
      this.setSaving(alert.id, false);
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

  protected cancelDelete(id: string): void {
    if (this.confirmingDelete() === id) this.confirmingDelete.set(null);
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

  private setSaving(id: string, saving: boolean): void {
    this.saving.update((ids) => {
      const next = new Set(ids);
      if (saving) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
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
