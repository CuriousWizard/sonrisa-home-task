import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ChannelId,
  channels,
  LIMITS,
  TargetInput,
  type ChannelField,
  type TargetDto,
} from '@alerts/shared';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { serverMessage } from '../core/errors';
import { TargetsApi } from '../core/targets.api';
import { selectClass } from '../layout/form-classes';
import { PageHeader } from '../layout/page-header';

interface RowMessage {
  tone: 'muted' | 'ok' | 'error';
  text: string;
}

// ChannelField<C> is not assignable across channels, because its key type depends on C.
interface ConfigField {
  key: string;
  label: string;
  inputType: ChannelField['inputType'];
}

const channelIds = ChannelId.options;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

// URL paths can hold the secret, as a Slack webhook path does, so URL fields show only the host.
function destination(target: TargetDto): string {
  const fields: readonly ConfigField[] = channels[target.channel].fields;
  const config = target.config as Record<string, unknown>;
  return fields
    .map((field) => {
      const value = config[field.key];
      if (typeof value !== 'string') return '';
      return field.inputType === 'url' ? hostOf(value) : value;
    })
    .filter((text) => text !== '')
    .join(', ');
}

@Component({
  selector: 'app-targets-page',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    HlmAlertImports,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    HlmTableImports,
  ],
  templateUrl: './targets-page.html',
})
export class TargetsPage {
  private readonly api = inject(TargetsApi);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly selectClass = selectClass;
  protected readonly channelOptions = channelIds.map((id) => ({
    id,
    label: channels[id].label,
  }));

  protected readonly targets = signal<TargetDto[] | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly rows = computed(() =>
    (this.targets() ?? []).map((target) => ({
      target,
      channelLabel: channels[target.channel].label,
      destination: destination(target),
    })),
  );
  protected readonly rowMessages = signal<Record<string, RowMessage>>({});
  protected readonly confirmingDelete = signal<string | null>(null);

  // Kept as its own reference, because fb.group types a nested FormRecord as a FormGroup.
  private readonly config = this.fb.record<string>({});
  protected readonly form = this.fb.group({
    name: '',
    channel: this.fb.control<ChannelId>(channelIds[0]),
    config: this.config,
  });
  protected readonly channel = toSignal(
    this.form.controls.channel.valueChanges,
    { initialValue: this.form.controls.channel.value },
  );
  protected readonly fields = computed<readonly ConfigField[]>(
    () => channels[this.channel()].fields,
  );
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly serverError = signal<string | null>(null);
  protected readonly pending = signal(false);

  constructor() {
    this.resetConfig(this.form.controls.channel.value);
    this.form.controls.channel.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => {
        this.resetConfig(id);
        this.errors.set({});
      });
    void this.load();
  }

  protected async sendTest(target: TargetDto): Promise<void> {
    this.setRowMessage(target.id, { tone: 'muted', text: 'Sending' });
    try {
      const result = await this.api.test(target.id);
      this.setRowMessage(
        target.id,
        result.ok
          ? { tone: 'ok', text: 'Sent' }
          : { tone: 'error', text: result.error },
      );
    } catch (error) {
      this.setRowMessage(target.id, {
        tone: 'error',
        text: serverMessage(error),
      });
    }
  }

  protected async remove(target: TargetDto): Promise<void> {
    if (this.confirmingDelete() !== target.id) {
      this.confirmingDelete.set(target.id);
      return;
    }
    this.confirmingDelete.set(null);
    this.setRowMessage(target.id, null);
    try {
      await this.api.remove(target.id);
      this.targets.update(
        (list) => list?.filter((item) => item.id !== target.id) ?? null,
      );
    } catch (error) {
      const text =
        error instanceof HttpErrorResponse && error.status === 409
          ? 'An alert still uses this target.'
          : serverMessage(error);
      this.setRowMessage(target.id, { tone: 'error', text });
    }
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  protected async create(): Promise<void> {
    this.serverError.set(null);
    const result = TargetInput.safeParse(this.form.getRawValue());
    if (!result.success) {
      this.errors.set(this.issueMessages(result.error.issues));
      return;
    }
    this.errors.set({});
    this.pending.set(true);
    try {
      const target = await this.api.create(result.data);
      this.targets.update((list) => [target, ...(list ?? [])]);
      this.form.controls.name.reset();
      this.config.reset();
    } catch (error) {
      this.serverError.set(serverMessage(error));
    } finally {
      this.pending.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      this.targets.set(await this.api.list());
    } catch (error) {
      this.loadError.set(serverMessage(error));
    }
  }

  private resetConfig(id: ChannelId): void {
    for (const key of Object.keys(this.config.controls)) {
      this.config.removeControl(key);
    }
    const fields: readonly ConfigField[] = channels[id].fields;
    for (const field of fields) {
      this.config.addControl(field.key, this.fb.control(''));
    }
  }

  private issueMessages(
    issues: readonly { path: readonly PropertyKey[] }[],
  ): Record<string, string> {
    const messages: Record<string, string> = {};
    for (const [first, second] of issues.map((issue) => issue.path)) {
      if (first === 'name') {
        messages['name'] = `Enter a name of up to ${LIMITS.name} characters.`;
      } else if (first === 'config' && typeof second === 'string') {
        const label =
          this.fields().find((field) => field.key === second)?.label ?? second;
        messages[`config.${second}`] = `${label} is not valid.`;
      }
    }
    return messages;
  }

  private setRowMessage(id: string, message: RowMessage | null): void {
    this.rowMessages.update((messages) => {
      const next = { ...messages };
      if (message) {
        next[id] = message;
      } else {
        delete next[id];
      }
      return next;
    });
  }
}
