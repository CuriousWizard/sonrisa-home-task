import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Category, type EventDto } from '@alerts/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { categoryLabels } from '../alerts/alert-form';
import { AdminApi } from '../core/admin.api';
import { serverMessage } from '../core/errors';
import { selectClass } from '../layout/form-classes';
import { LocalDateTimePipe } from '../layout/local-date-time.pipe';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-events-page',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    LocalDateTimePipe,
    HlmButtonImports,
    HlmLabelImports,
    HlmTableImports,
  ],
  templateUrl: './events-page.html',
})
export class EventsPage {
  private readonly api = inject(AdminApi);

  protected readonly selectClass = selectClass;
  protected readonly categories = Category.options;
  protected readonly categoryLabels = categoryLabels;
  protected readonly category = inject(NonNullableFormBuilder).control<
    Category | ''
  >('');
  protected readonly events = signal<EventDto[] | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loading = signal(false);
  private requestId = 0;

  constructor() {
    this.category.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.load());
    void this.load();
  }

  protected async load(): Promise<void> {
    // Only the newest request may fill the table, so a slow response for an old filter is dropped.
    const id = ++this.requestId;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const events = await this.api.events({
        category: this.category.value || undefined,
      });
      if (id === this.requestId) this.events.set(events);
    } catch (error) {
      if (id === this.requestId) this.loadError.set(serverMessage(error));
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}
