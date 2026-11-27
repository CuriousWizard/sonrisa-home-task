import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  LIMITS,
  type AdminDeliveriesQuery,
  type AdminEventsQuery,
  type AdminUserDto,
  type AlertDto,
  type ChannelDto,
  type ChannelId,
  type DeliveryDto,
  type EventDto,
  type MetricsDto,
  type PatchEnabled,
  type SourceDto,
} from '@alerts/shared';
import { firstValueFrom } from 'rxjs';

const BASE = '/api/admin';

// The pages have no paging, so every list asks for the most rows the API allows.
function listParams(
  query: Record<string, string | undefined> = {},
): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params[key] = value;
  }
  params['limit'] = LIMITS.listMax;
  return params;
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  users(): Promise<AdminUserDto[]> {
    return firstValueFrom(
      this.http.get<AdminUserDto[]>(`${BASE}/users`, { params: listParams() }),
    );
  }

  alerts(userId: string): Promise<AlertDto[]> {
    return firstValueFrom(
      this.http.get<AlertDto[]>(`${BASE}/alerts`, {
        params: listParams({ userId }),
      }),
    );
  }

  events(query: Omit<AdminEventsQuery, 'limit'>): Promise<EventDto[]> {
    return firstValueFrom(
      this.http.get<EventDto[]>(`${BASE}/events`, {
        params: listParams(query),
      }),
    );
  }

  deliveries(
    query: Omit<AdminDeliveriesQuery, 'limit'>,
  ): Promise<DeliveryDto[]> {
    return firstValueFrom(
      this.http.get<DeliveryDto[]>(`${BASE}/deliveries`, {
        params: listParams(query),
      }),
    );
  }

  retryDelivery(id: string): Promise<DeliveryDto> {
    return firstValueFrom(
      this.http.post<DeliveryDto>(
        `${BASE}/deliveries/${encodeURIComponent(id)}/retry`,
        null,
      ),
    );
  }

  sources(): Promise<SourceDto[]> {
    return firstValueFrom(this.http.get<SourceDto[]>(`${BASE}/sources`));
  }

  setSourceEnabled(id: string, enabled: boolean): Promise<SourceDto> {
    const body: PatchEnabled = { enabled };
    return firstValueFrom(
      this.http.patch<SourceDto>(
        `${BASE}/sources/${encodeURIComponent(id)}`,
        body,
      ),
    );
  }

  channels(): Promise<ChannelDto[]> {
    return firstValueFrom(this.http.get<ChannelDto[]>(`${BASE}/channels`));
  }

  setChannelEnabled(id: ChannelId, enabled: boolean): Promise<ChannelDto> {
    const body: PatchEnabled = { enabled };
    return firstValueFrom(
      this.http.patch<ChannelDto>(
        `${BASE}/channels/${encodeURIComponent(id)}`,
        body,
      ),
    );
  }

  metrics(): Promise<MetricsDto> {
    return firstValueFrom(this.http.get<MetricsDto>(`${BASE}/metrics`));
  }
}
