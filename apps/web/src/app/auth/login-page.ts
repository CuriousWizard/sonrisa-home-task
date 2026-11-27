import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoginInput } from '@alerts/shared';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AuthStore } from '../core/auth.store';
import { fieldErrors, serverMessage } from '../core/errors';

const messages = {
  email: 'Enter a valid email address.',
  password: 'Enter your password.',
};

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmLabelImports,
  ],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: '',
    password: '',
  });
  protected readonly errors = signal<Partial<typeof messages>>({});
  protected readonly serverError = signal<string | null>(null);
  protected readonly pending = signal(false);

  protected async submit(): Promise<void> {
    this.serverError.set(null);
    const result = LoginInput.safeParse(this.form.getRawValue());
    if (!result.success) {
      this.errors.set(fieldErrors(result.error.issues, messages));
      return;
    }
    this.errors.set({});
    this.pending.set(true);
    try {
      await this.auth.login(result.data);
      await this.router.navigateByUrl('/alerts');
    } catch (error) {
      this.serverError.set(serverMessage(error));
    } finally {
      this.pending.set(false);
    }
  }
}
