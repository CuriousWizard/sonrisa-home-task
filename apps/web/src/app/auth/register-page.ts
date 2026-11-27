import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LIMITS, RegisterInput } from '@alerts/shared';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AuthStore } from '../core/auth.store';
import { fieldErrors, serverMessage } from '../core/errors';

const messages = {
  email: 'Enter a valid email address.',
  password: `Use ${LIMITS.passwordMin} to ${LIMITS.passwordMax} characters.`,
};

@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmLabelImports,
  ],
  templateUrl: './register-page.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly passwordMin = LIMITS.passwordMin;
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: '',
    password: '',
  });
  protected readonly errors = signal<Partial<typeof messages>>({});
  protected readonly serverError = signal<string | null>(null);
  protected readonly pending = signal(false);

  protected async submit(): Promise<void> {
    this.serverError.set(null);
    const result = RegisterInput.safeParse(this.form.getRawValue());
    if (!result.success) {
      this.errors.set(fieldErrors(result.error.issues, messages));
      return;
    }
    this.errors.set({});
    this.pending.set(true);
    try {
      await this.auth.register(result.data);
      await this.router.navigateByUrl('/alerts');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.errors.set({ email: 'This email is already registered.' });
      } else {
        this.serverError.set(serverMessage(error));
      }
    } finally {
      this.pending.set(false);
    }
  }
}
