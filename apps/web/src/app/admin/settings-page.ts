import { Component, inject, signal, type WritableSignal } from '@angular/core';
import type { ChannelDto, SourceDto } from '@alerts/shared';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { categoryLabels } from '../alerts/alert-form';
import { AdminApi } from '../core/admin.api';
import { serverMessage } from '../core/errors';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-settings-page',
  imports: [PageHeader, HlmSwitchImports, HlmTableImports],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  private readonly api = inject(AdminApi);

  protected readonly categoryLabels = categoryLabels;
  protected readonly sources = signal<SourceDto[] | null>(null);
  protected readonly channels = signal<ChannelDto[] | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly rowErrors = signal<Record<string, string>>({});
  // Rows with a PATCH in flight. Their switch is disabled so a second toggle cannot race the first.
  protected readonly saving = signal<ReadonlySet<string>>(new Set());

  constructor() {
    void this.load();
  }

  protected setSourceEnabled(
    source: SourceDto,
    enabled: boolean,
  ): Promise<void> {
    return this.setEnabled(
      this.sources,
      `source:${source.id}`,
      { ...source, enabled },
      source,
      () => this.api.setSourceEnabled(source.id, enabled),
    );
  }

  protected setChannelEnabled(
    channel: ChannelDto,
    enabled: boolean,
  ): Promise<void> {
    return this.setEnabled(
      this.channels,
      `channel:${channel.id}`,
      { ...channel, enabled },
      channel,
      () => this.api.setChannelEnabled(channel.id, enabled),
    );
  }

  private async load(): Promise<void> {
    try {
      const [sources, channels] = await Promise.all([
        this.api.sources(),
        this.api.channels(),
      ]);
      this.sources.set(sources);
      this.channels.set(channels);
    } catch (error) {
      this.loadError.set(serverMessage(error));
    }
  }

  // The switch shows the new value at once and goes back to the old one if the request fails.
  private async setEnabled<T extends { id: string }>(
    list: WritableSignal<T[] | null>,
    errorKey: string,
    optimistic: T,
    previous: T,
    patch: () => Promise<T>,
  ): Promise<void> {
    const replace = (next: T): void =>
      list.update(
        (items) =>
          items?.map((current) => (current.id === next.id ? next : current)) ??
          null,
      );
    this.setRowError(errorKey, null);
    this.setSaving(errorKey, true);
    replace(optimistic);
    try {
      replace(await patch());
    } catch (error) {
      replace(previous);
      this.setRowError(errorKey, serverMessage(error));
    } finally {
      this.setSaving(errorKey, false);
    }
  }

  private setSaving(key: string, saving: boolean): void {
    this.saving.update((keys) => {
      const next = new Set(keys);
      if (saving) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  private setRowError(key: string, message: string | null): void {
    this.rowErrors.update((errors) => {
      const next = { ...errors };
      if (message) {
        next[key] = message;
      } else {
        delete next[key];
      }
      return next;
    });
  }
}
