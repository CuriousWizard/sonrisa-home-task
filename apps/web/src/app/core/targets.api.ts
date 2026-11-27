import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  LIMITS,
  type TargetDto,
  type TargetInput,
  type TargetTestResult,
} from '@alerts/shared';
import { firstValueFrom } from 'rxjs';

const BASE = '/api/targets';

@Injectable({ providedIn: 'root' })
export class TargetsApi {
  private readonly http = inject(HttpClient);

  // The pages have no paging, so they ask for the most rows the API allows.
  list(): Promise<TargetDto[]> {
    return firstValueFrom(
      this.http.get<TargetDto[]>(BASE, { params: { limit: LIMITS.listMax } }),
    );
  }

  create(input: TargetInput): Promise<TargetDto> {
    return firstValueFrom(this.http.post<TargetDto>(BASE, input));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${BASE}/${encodeURIComponent(id)}`),
    );
  }

  test(id: string): Promise<TargetTestResult> {
    return firstValueFrom(
      this.http.post<TargetTestResult>(
        `${BASE}/${encodeURIComponent(id)}/test`,
        null,
      ),
    );
  }
}
