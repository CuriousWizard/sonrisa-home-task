import { Component, computed, inject, signal } from '@angular/core';
import {
  Category,
  ChannelId,
  DeliveryStatus,
  type MetricsDto,
} from '@alerts/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { categoryLabels } from '../alerts/alert-form';
import { AdminApi } from '../core/admin.api';
import { serverMessage } from '../core/errors';
import { LocalDateTimePipe } from '../layout/local-date-time.pipe';
import { PageHeader } from '../layout/page-header';
import { channelLabels, deliveryStatusLabels } from './labels';

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

interface MetricsCard {
  id: string;
  title: string;
  description?: string;
  rows: { label: string; value: string }[];
}

function toCards(metrics: MetricsDto): MetricsCard[] {
  return [
    {
      id: 'events',
      title: 'Events per category',
      rows: Category.options.map((category) => ({
        label: categoryLabels[category],
        value: String(metrics.eventsByCategory[category]),
      })),
    },
    {
      id: 'deliveries',
      title: 'Deliveries per status',
      rows: DeliveryStatus.options.map((status) => ({
        label: deliveryStatusLabels[status],
        value: String(metrics.deliveriesByStatus[status]),
      })),
    },
    {
      id: 'failure-rate',
      title: 'Failure rate per channel',
      description: 'Dead deliveries out of sent and dead ones.',
      rows: ChannelId.options.map((channel) => ({
        label: channelLabels[channel],
        value: formatRate(metrics.failureRateByChannel[channel]),
      })),
    },
  ];
}

@Component({
  selector: 'app-metrics-page',
  imports: [PageHeader, LocalDateTimePipe, HlmButtonImports, HlmCardImports],
  templateUrl: './metrics-page.html',
})
export class MetricsPage {
  private readonly api = inject(AdminApi);

  protected readonly metrics = signal<MetricsDto | null>(null);
  protected readonly cards = computed(() => {
    const metrics = this.metrics();
    return metrics ? toCards(metrics) : [];
  });
  protected readonly loadError = signal<string | null>(null);
  protected readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.metrics.set(await this.api.metrics());
    } catch (error) {
      this.loadError.set(serverMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
