import {
  Component,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AlertInput,
  Category,
  channels,
  DisasterType,
  Region,
  type MarketDirection,
  type TargetDto,
} from '@alerts/shared';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { AlertsApi } from '../core/alerts.api';
import { serverMessage } from '../core/errors';
import { TargetsApi } from '../core/targets.api';
import { checkboxClass, selectClass } from '../layout/form-classes';
import { PageHeader } from '../layout/page-header';
import {
  alertErrors,
  categoryLabels,
  directionLabels,
  disasterTypeLabels,
  emptyAlertForm,
  fromAlertDto,
  regionLabels,
  toAlertInput,
  type AlertErrors,
} from './alert-form';

@Component({
  selector: 'app-alert-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    HlmAlertImports,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    HlmSwitchImports,
  ],
  templateUrl: './alert-form-page.html',
})
export class AlertFormPage implements OnInit {
  // Bound from the :id route param. Undefined on /alerts/new.
  readonly id = input<string>();

  private readonly alertsApi = inject(AlertsApi);
  private readonly targetsApi = inject(TargetsApi);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly selectClass = selectClass;
  protected readonly checkboxClass = checkboxClass;
  protected readonly categories = Category.options;
  protected readonly categoryLabels = categoryLabels;
  protected readonly directions: MarketDirection[] = ['any', 'up', 'down'];
  protected readonly directionLabels = directionLabels;
  protected readonly disasterTypes = DisasterType.options;
  protected readonly disasterTypeLabels = disasterTypeLabels;
  protected readonly regions = Region.options;
  protected readonly regionLabels = regionLabels;
  protected readonly severities = [1, 2, 3, 4, 5];

  protected readonly heading = computed(() =>
    this.id() ? 'Edit alert' : 'New alert',
  );
  protected readonly state = signal<
    'loading' | 'error' | 'no-targets' | 'ready'
  >('loading');
  protected readonly loadError = signal<string | null>(null);
  protected readonly targets = signal<
    { id: string; name: string; channelLabel: string }[]
  >([]);

  // Kept as its own reference, because fb.group types a nested FormRecord as a FormGroup.
  private readonly targetFlags = this.fb.record<boolean>({});
  protected readonly form = this.buildForm();
  protected readonly category = toSignal(
    this.form.controls.category.valueChanges,
    { initialValue: this.form.controls.category.value },
  );
  protected readonly errors = signal<AlertErrors>({});
  protected readonly serverError = signal<string | null>(null);
  protected readonly pending = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  // Bound to the select's change event, so loading an alert into the form keeps its filters.
  protected resetFilters(): void {
    this.form.controls.news.reset();
    this.form.controls.market.reset();
    this.form.controls.disaster.reset();
    this.errors.set({});
  }

  protected async submit(): Promise<void> {
    this.serverError.set(null);
    const result = AlertInput.safeParse(toAlertInput(this.form.getRawValue()));
    if (!result.success) {
      this.errors.set(alertErrors(result.error.issues));
      return;
    }
    this.errors.set({});
    this.pending.set(true);
    try {
      const id = this.id();
      if (id) {
        await this.alertsApi.update(id, result.data);
      } else {
        await this.alertsApi.create(result.data);
      }
      await this.router.navigateByUrl('/alerts');
    } catch (error) {
      this.serverError.set(serverMessage(error));
    } finally {
      this.pending.set(false);
    }
  }

  private async load(): Promise<void> {
    const id = this.id();
    try {
      const [targets, alert] = await Promise.all([
        this.targetsApi.list(),
        id ? this.alertsApi.get(id) : null,
      ]);
      this.addTargetControls(targets);
      if (alert) {
        this.form.patchValue(fromAlertDto(alert));
      }
      this.state.set(targets.length === 0 ? 'no-targets' : 'ready');
    } catch (error) {
      this.loadError.set(serverMessage(error));
      this.state.set('error');
    }
  }

  private addTargetControls(targets: TargetDto[]): void {
    for (const target of targets) {
      this.targetFlags.addControl(target.id, this.fb.control(false));
    }
    this.targets.set(
      targets.map((target) => ({
        id: target.id,
        name: target.name,
        channelLabel: channels[target.channel].label,
      })),
    );
  }

  private buildForm() {
    const initial = emptyAlertForm();
    return this.fb.group({
      name: initial.name,
      category: this.fb.control(initial.category),
      news: this.fb.group(initial.news),
      market: this.fb.group(initial.market),
      disaster: this.fb.group({
        types: this.fb.group(initial.disaster.types),
        regions: this.fb.group(initial.disaster.regions),
        minMagnitude: this.fb.control(initial.disaster.minMagnitude),
      }),
      minSeverity: initial.minSeverity,
      targets: this.targetFlags,
      enabled: initial.enabled,
    });
  }
}
