import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  LIMITS,
  type AlertDto,
  type AlertInput,
  type PatchEnabled,
} from '@alerts/shared';
import { firstValueFrom } from 'rxjs';

const BASE = '/api/alerts';

function alertUrl(id: string): string {
  return `${BASE}/${encodeURIComponent(id)}`;
}

@Injectable({ providedIn: 'root' })
export class AlertsApi {
  private readonly http = inject(HttpClient);

  list(): Promise<AlertDto[]> {
    return firstValueFrom(
      this.http.get<AlertDto[]>(BASE, { params: { limit: LIMITS.listMax } }),
    );
  }

  get(id: string): Promise<AlertDto> {
    return firstValueFrom(this.http.get<AlertDto>(alertUrl(id)));
  }

  create(input: AlertInput): Promise<AlertDto> {
    return firstValueFrom(this.http.post<AlertDto>(BASE, input));
  }

  update(id: string, input: AlertInput): Promise<AlertDto> {
    return firstValueFrom(this.http.put<AlertDto>(alertUrl(id), input));
  }

  setEnabled(id: string, enabled: boolean): Promise<AlertDto> {
    const body: PatchEnabled = { enabled };
    return firstValueFrom(this.http.patch<AlertDto>(alertUrl(id), body));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(alertUrl(id)));
  }
}
