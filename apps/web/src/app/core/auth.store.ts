import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import type { LoginInput, RegisterInput, UserDto } from '@alerts/shared';
import { firstValueFrom } from 'rxjs';

export const ME_URL = '/api/auth/me';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly _user = signal<UserDto | null>(null);
  private request: Promise<UserDto | null> | null = null;

  readonly user = this._user.asReadonly();
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  // Calls GET /api/auth/me on first use only. Errors other than 401 are not cached, so the next call retries.
  load(): Promise<UserDto | null> {
    this.request ??= firstValueFrom(this.http.get<UserDto>(ME_URL)).then(
      (user) => {
        this._user.set(user);
        return user;
      },
      (error: unknown) => {
        if (!(error instanceof HttpErrorResponse && error.status === 401)) {
          this.request = null;
        }
        this._user.set(null);
        return null;
      },
    );
    return this.request;
  }

  async login(input: LoginInput): Promise<UserDto> {
    const user = await firstValueFrom(
      this.http.post<UserDto>('/api/auth/login', input),
    );
    this.setUser(user);
    return user;
  }

  async register(input: RegisterInput): Promise<UserDto> {
    const user = await firstValueFrom(
      this.http.post<UserDto>('/api/auth/register', input),
    );
    this.setUser(user);
    return user;
  }

  // A 401 means the session has already ended. Other errors keep the user, because the cookie can still be valid.
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/logout', null));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        throw error;
      }
    }
    this.clear();
  }

  clear(): void {
    this.setUser(null);
  }

  private setUser(user: UserDto | null): void {
    this._user.set(user);
    this.request = Promise.resolve(user);
  }
}
