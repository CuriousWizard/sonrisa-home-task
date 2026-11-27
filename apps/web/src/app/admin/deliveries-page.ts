import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ChannelId, DeliveryStatus, type DeliveryDto } from '@alerts/shared';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { AdminApi } from '../core/admin.api';
import { serverMessage } from '../core/errors';
import { selectClass } from '../layout/form-classes';
import { LocalDateTimePipe } from '../layout/local-date-time.pipe';
import { PageHeader } from '../layout/page-header';
import { channelLabels, deliveryStatusLabels } from './labels';

const RETRYABLE: readonly DeliveryStatus[] = ['failed', 'dead', 'skipped'];

const statusClasses: Record<DeliveryStatus, string> = {
  pending: 'border-border bg-transparent text-foreground',
  sending: 'border-border bg-transparent text-foreground',
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-amber-100 text-amber-900',
  dead: 'bg-red-100 text-red-800',
  skipped: 'bg-neutral-200 text-neutral-700',
};

@Component({
  selector: 'app-deliveries-page',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    LocalDateTimePipe,
    HlmBadgeImports,
    HlmButtonImports,
    HlmLabelImports,
    HlmTableImports,
  ],
  templateUrl: './deliveries-page.html',
})
export class DeliveriesPage {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly selectClass = selectClass;
  protected readonly statuses = DeliveryStatus.options;
  protected readonly statusLabels = deliveryStatusLabels;
  protected readonly statusClasses = statusClasses;
  protected readonly channelIds = ChannelId.options;
  protected readonly channelLabels = channelLabels;
  protected readonly filters = this.fb.group({
    status: this.fb.control<DeliveryStatus | ''>(''),
    channel: this.fb.control<ChannelId | ''>(''),
  });
  protected readonly deliveries = signal<DeliveryDto[] | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly retrying = signal(false);
  protected readonly rowErrors = signal<Record<string, string>>({});
  private requestId = 0;

  constructor() {
    this.filters.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.load());
    void this.load();
  }

  protected canRetry(delivery: DeliveryDto): boolean {
    return RETRYABLE.includes(delivery.status);
  }

  protected async load(): Promise<void> {
    // Only the newest request may fill the table, so a slow response for an old filter is dropped.
    const id = ++this.requestId;
    const { status, channel } = this.filters.getRawValue();
    this.loading.set(true);
    this.loadError.set(null);
    this.rowErrors.set({});
    try {
      const deliveries = await this.api.deliveries({
        status: status || undefined,
        channel: channel || undefined,
      });
      if (id === this.requestId) this.deliveries.set(deliveries);
    } catch (error) {
      if (id === this.requestId) this.loadError.set(serverMessage(error));
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  protected async retry(delivery: DeliveryDto): Promise<void> {
    this.retrying.set(true);
    this.setRowError(delivery.id, null);
    try {
      await this.api.retryDelivery(delivery.id);
      await this.load();
    } catch (error) {
      this.setRowError(
        delivery.id,
        error instanceof HttpErrorResponse && error.status === 409
          ? 'This delivery can no longer be retried.'
          : serverMessage(error),
      );
    } finally {
      this.retrying.set(false);
    }
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
