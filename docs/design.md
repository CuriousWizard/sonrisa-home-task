# Design

This document is the contract between the implementer subagents. Requirement ids such as R9 refer to `docs/requirements.md`.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    Web[Angular 22 app<br/>port 4200]
  end
  subgraph API[Fastify API, port 3000]
    Routes[HTTP routes]
    Sched[Source scheduler]
    Ingest[Ingest and match]
    Worker[Delivery worker]
    Reg[Channel registry]
    Mock[Mock Slack receiver<br/>dev only]
  end
  PG[(PostgreSQL 18)]
  Mailpit[Mailpit<br/>SMTP 1025, UI 8025]

  Web -- "/api via dev proxy" --> Routes
  Sched --> Ingest
  Routes -- "/api/dev/events" --> Ingest
  Ingest --> PG
  Worker --> PG
  Worker --> Reg
  Reg -- email --> Mailpit
  Reg -- slack --> Mock
```

One API process runs the HTTP server, the source scheduler and the delivery worker. The Angular dev server proxies `/api` to the API, so the browser sees one origin and the auth cookie works without CORS.

## Event flow

```mermaid
sequenceDiagram
  participant S as Source or /api/dev/events
  participant I as ingestEvent
  participant DB as PostgreSQL
  participant W as Worker
  participant C as Channel
  S->>I: NewEvent
  I->>DB: BEGIN, insert event
  I->>DB: select enabled alerts where category matches and min_severity <= severity
  I->>I: matchesFilters(event, alert) for each alert
  I->>DB: insert deliveries ... on conflict do nothing
  I->>DB: COMMIT
  loop every WORKER_POLL_MS
    W->>DB: claim up to 10 due rows with FOR UPDATE SKIP LOCKED
    W->>C: send(config, message)
    alt success
      W->>DB: status = sent
    else error, attempts < max
      W->>DB: status = failed, next_attempt_at = now + backoff
    else error, attempts = max
      W->>DB: status = dead
    end
  end
```

Filter matching runs in TypeScript, not SQL. The SQL query only narrows by category, `enabled` and `min_severity`. This keeps every filter rule in one pure function with unit tests.

## Repository layout

```text
apps/
  api/src/
    main.ts              starts the server, scheduler and worker
    app.ts               buildApp(config) for tests and main
    config.ts            reads env with zod
    db/                  schema.ts, client.ts, migrations/, seed.ts
    auth/                routes, password.ts, plugin with requireUser and requireAdmin
    targets/             routes, service
    alerts/              routes, service
    events/              ingest.ts
    matching/            match.ts, severity.ts
    delivery/            worker.ts, backoff.ts, message.ts
    channels/            channel.ts, registry.ts, email.ts, slack.ts, slack-url.ts
    sources/             source.ts, registry.ts, scheduler.ts, simulated/{news,market,disaster}.ts
    admin/               routes
    dev/                 routes for event injection and the mock Slack receiver
  web/src/app/
    core/                api client, auth store, guards
    auth/                login and register pages
    alerts/              list and form
    targets/             list and form
    admin/               users, events, deliveries, settings, metrics
  web-e2e/               Playwright
libs/
  shared/src/            zod schemas, types, channel descriptors
docker-compose.yml
.env.example
```

## Shared library

`libs/shared` holds every type that crosses the HTTP boundary, as zod schemas with inferred TypeScript types. Both apps import from it.

- `Category = 'news' | 'market' | 'disaster'`
- `Region = 'africa' | 'asia' | 'europe' | 'north-america' | 'south-america' | 'oceania'`
- `Severity`: integer from 1 to 5
- `EventData`: a discriminated union on `category`
  - news: `{}`. The text is in `title` and `summary`.
  - market: `{ symbol: string, price: number, changePct: number }`. `changePct` is signed.
  - disaster: `{ type: 'earthquake' | 'flood' | 'storm' | 'wildfire', region: Region, magnitude?: number }`
- `AlertFilters`: a discriminated union on `category`
  - news: `{ keywords: string[] }`
  - market: `{ symbols: string[], direction: 'up' | 'down' | 'any', minChangePct: number }`
  - disaster: `{ types: DisasterType[], regions: Region[], minMagnitude?: number }`
- `TargetConfig` per channel
  - email: `{ address: string }`
  - slack: `{ webhookUrl: string }`
- `channelDescriptors`: for each channel, a label and a list of form fields `{ key, label, inputType }`. The web app builds the target form from this list, so a new channel needs no new form component.
- Request and response DTOs for every route below.

## Data model

All ids are UUIDs except `sources.id` and `channels.id`. All timestamps are `timestamptz` in UTC.

| Table | Columns | Constraints and indexes |
|---|---|---|
| `users` | id, email, password_hash, role, created_at | email unique, stored lowercase. role in (`user`, `admin`) |
| `targets` | id, user_id, name, channel, config jsonb, created_at | user_id references users on delete cascade |
| `alerts` | id, user_id, name, category, filters jsonb, min_severity, enabled, created_at, updated_at | user_id references users on delete cascade. min_severity between 1 and 5 |
| `alert_targets` | alert_id, target_id | primary key on both. Both reference their tables on delete cascade |
| `events` | id, source_id, external_id, category, title, summary, severity, data jsonb, occurred_at, created_at | unique (source_id, external_id). Index (category, created_at desc) |
| `sources` | id, category, enabled, updated_at | Seeded rows: `news-sim`, `market-sim`, `disaster-sim` |
| `channels` | id, enabled, updated_at | Seeded rows: `email`, `slack` |
| `deliveries` | id, alert_id, event_id, target_id, channel, status, attempts, next_attempt_at, last_error, sent_at, created_at, updated_at | unique (alert_id, event_id, target_id) for R9. Index (status, next_attempt_at) |

`events.external_id` lets a future real source skip events it has already stored. Simulators set it to a random UUID.

`deliveries.channel` is copied from the target when the row is created, so metrics per channel need no join.

### Delivery states

```mermaid
stateDiagram-v2
  [*] --> pending: channel enabled
  [*] --> skipped: channel disabled (R11)
  pending --> sending: worker claims
  failed --> sending: worker claims after next_attempt_at
  sending --> sent: send ok
  sending --> failed: error and attempts < max
  sending --> dead: error and attempts = max
  sending --> sending: lease expired, claimed again
  pending --> skipped: channel disabled before send
  failed --> pending: admin retry
  dead --> pending: admin retry
```

- Claim query: rows with status `pending` or `failed` and `next_attempt_at <= now()`, plus rows with status `sending` whose lease has expired. The claim sets status `sending`, increments `attempts`, and sets `next_attempt_at = now() + 60s` as a lease. A worker that crashes mid-send leaves the row to be claimed again after 60 seconds.
- Delivery is therefore at least once. A crash after a successful send and before the status update sends the message a second time. This is acceptable for alerts.
- Backoff after failed attempt n: `DELIVERY_BACKOFF_BASE_MS * 2^(n-1)`, plus up to 10% random jitter. With the default base of 30 seconds, the waits are 30 s, 60 s, 120 s and 240 s. The fifth failure sets `dead`. `computeBackoff(attempt, baseMs, random)` takes `random` as an argument so tests are deterministic.
- Admin retry (R14) is allowed only from `failed` or `dead`. It sets status `pending`, `attempts = 0`, `next_attempt_at = now()` and clears `last_error`.
- When the worker claims a row whose channel is disabled, it sets `skipped` without sending.

## Matching rules

`matchesFilters(event, alert)` returns true only when the event category equals the alert category, `event.severity >= alert.minSeverity`, and the category rule below holds.

| Category | Rule |
|---|---|
| news | `keywords` is empty, or at least one keyword appears in the title or summary as a whole word, case-insensitive. Keywords are regex-escaped before use. |
| market | `symbols` is empty or contains the event symbol, compared in uppercase. `direction` is `any`, or `up` with `changePct > 0`, or `down` with `changePct < 0`. `abs(changePct) >= minChangePct`. |
| disaster | `types` is empty or contains the event type. `regions` is empty or contains the event region. If `minMagnitude` is set and the event is an earthquake, `magnitude >= minMagnitude`. `minMagnitude` is ignored for other types. |

### Severity for simulated events

| Category | Severity |
|---|---|
| market | from `abs(changePct)`: below 2 is 1, below 5 is 2, below 10 is 3, below 20 is 4, otherwise 5 |
| disaster, earthquake | from magnitude: below 5 is 1, below 6 is 2, below 7 is 3, below 8 is 4, otherwise 5 |
| disaster, other types | random from 1 to 5 |
| news | random from 1 to 5. Titles of severity 4 and 5 start with "Breaking:" |

Simulated market moves are mostly small, so high severity is rare on the timer. Demos use `/api/dev/events` to get a specific event.

## Extension points

### Channels

```ts
interface NotificationChannel<C> {
  readonly id: ChannelId;
  readonly configSchema: ZodType<C>;
  // Extra server-side checks, such as the Slack URL allowlist. Throws on invalid config.
  assertConfigAllowed?(config: C): void;
  // Throws on failure. The worker records the error message.
  send(config: C, message: NotificationMessage): Promise<void>;
}

interface NotificationMessage {
  subject: string;
  text: string;
}
```

`delivery/message.ts` builds one `NotificationMessage` from an event and an alert. Email sends `subject` and `text`. Slack posts `{ "text": "*<subject>*\n<text>" }`.

To add a channel:

1. Add its config schema and descriptor in `libs/shared`.
2. Add a class in `apps/api/src/channels/` that implements `NotificationChannel`.
3. Register it in `channels/registry.ts` and add a row to the `channels` table in the seed.

### Sources

```ts
interface EventSource {
  readonly id: string;
  readonly category: Category;
  // Delay before the next poll.
  nextDelayMs(): number;
  poll(): Promise<NewEvent[]>;
}
```

The scheduler keeps one `setTimeout` chain per registered source. Before each poll it reads `sources.enabled` from the database and skips the poll if the source is disabled (R15). Each simulator returns one event per poll and a delay between `SOURCE_MIN_INTERVAL_MS` and `SOURCE_MAX_INTERVAL_MS` (R7). A real source, such as the USGS feed, would return many events per poll and rely on `external_id` to skip repeats.

## Security

| Concern | Measure |
|---|---|
| Password storage | `node:crypto` scrypt with a 16-byte random salt. Stored as `scrypt$N$r$p$salt$hash`. Compared with `timingSafeEqual`. No native module is needed. |
| Session | JWT signed with HS256 and `JWT_SECRET`, which must be at least 32 characters. Claims are `sub` and `role`. Expiry is 8 hours. Sent in an `HttpOnly`, `SameSite=Strict` cookie, with `Secure` in production. |
| CSRF | `SameSite=Strict` stops browsers from sending the cookie on cross-site requests. Mutating routes accept only `application/json`. |
| Authorization | `requireUser` verifies the JWT and loads the user from the database, so a deleted user loses access at once. `requireAdmin` also checks `role = 'admin'`. Every admin route uses `requireAdmin`. |
| Object access | Every target and alert query filters by `user_id`. A request for another user's object returns 404. Alert `targetIds` must belong to the same user. |
| Brute force | `@fastify/rate-limit` on `/api/auth/login` and `/api/auth/register`: 10 requests per minute per IP. |
| Input validation | Every body, query and params object is validated with the shared zod schemas. Drizzle parameterizes all queries. |
| SSRF through Slack URLs | `slack-url.ts` parses the URL with `new URL()`. It then checks that `origin + pathname` starts with one of the prefixes in `SLACK_WEBHOOK_ALLOWED_PREFIXES`. The check runs on target create and again before each send. Requests use `redirect: 'error'` and a 5 second timeout. |
| Dev routes | `/api/dev/*` is registered only when `NODE_ENV !== 'production'`. |

## HTTP API

All routes start with `/api`. Errors use the Fastify default shape `{ statusCode, error, message }`. List routes take `limit` (default 50, maximum 200) and `before` (an ISO timestamp cursor on `created_at`).

### Auth

| Method and path | Access | Body or query | Result |
|---|---|---|---|
| POST /auth/register | public | `{ email, password }`, password at least 10 characters | 201, sets cookie, returns user |
| POST /auth/login | public | `{ email, password }` | 200, sets cookie, returns user. 401 with one generic message for any failure |
| POST /auth/logout | user | none | 204, clears cookie |
| GET /auth/me | user | none | `{ id, email, role }` |

### Targets (R2, R3)

| Method and path | Body | Result |
|---|---|---|
| GET /targets | none | the user's targets |
| POST /targets | `{ name, channel, config }` | 201. 400 if the config fails the schema or the Slack allowlist |
| DELETE /targets/:id | none | 204. 409 if an alert still uses the target |
| POST /targets/:id/test | none | sends a test message at once, without the queue. Returns `{ ok: true }` or `{ ok: false, error }` |

### Alerts (R4 to R6)

| Method and path | Body | Result |
|---|---|---|
| GET /alerts | none | the user's alerts with their target ids |
| POST /alerts | `{ name, category, filters, minSeverity, targetIds, enabled }`. `targetIds` has at least one id | 201 |
| GET /alerts/:id | none | one alert |
| PUT /alerts/:id | same as POST | 200 |
| PATCH /alerts/:id | `{ enabled }` | 200 |
| DELETE /alerts/:id | none | 204 |

`filters.category` must equal `category`. The schema rejects a mismatch with 400.

### Admin (R12 to R16)

| Method and path | Query or body | Result |
|---|---|---|
| GET /admin/users | `limit`, `before` | users with alert counts |
| GET /admin/alerts | `userId` | that user's alerts |
| GET /admin/events | `category`, `limit`, `before` | events, newest first |
| GET /admin/deliveries | `status`, `channel`, `limit`, `before` | deliveries with event title, alert name and user email |
| POST /admin/deliveries/:id/retry | none | 200. 409 unless the status is `failed` or `dead` |
| GET /admin/sources | none | sources with `enabled` |
| PATCH /admin/sources/:id | `{ enabled }` | 200 |
| GET /admin/channels | none | channels with `enabled` |
| PATCH /admin/channels/:id | `{ enabled }` | 200 |
| GET /admin/metrics | none | see below |

Metrics cover rows created in the last 24 hours:

```json
{
  "since": "2026-11-25T12:00:00Z",
  "eventsByCategory": { "news": 0, "market": 0, "disaster": 0 },
  "deliveriesByStatus": { "pending": 0, "sending": 0, "sent": 0, "failed": 0, "dead": 0, "skipped": 0 },
  "failureRateByChannel": { "email": 0, "slack": 0 }
}
```

Failure rate for a channel is `dead / (sent + dead)`. It is 0 when both counts are 0.

### Dev only (R17, R18)

| Method and path | Body | Result |
|---|---|---|
| POST /dev/events | `{ category, title, summary, severity, data }` | 201. Uses `ingestEvent` with `source_id = 'dev'`. Returns the event and the number of deliveries created |
| POST /dev/mock-slack/:hookId | any JSON | stores the message in memory. Returns 500 while fail mode is on, otherwise 200 |
| GET /dev/mock-slack/messages | none | stored messages |
| DELETE /dev/mock-slack/messages | none | 204, clears the store |
| PUT /dev/mock-slack/mode | `{ fail: boolean }` | 200 |

## Web app

Angular 22 with standalone components and signals, using the defaults that `@nx/angular` generates. UI components come from spartan-ng with Tailwind 4.

| Route | Access | Content |
|---|---|---|
| /login, /register | public | forms |
| /alerts | user | list with an enable switch per alert |
| /alerts/new, /alerts/:id | user | form. The category select decides which filter fields appear. Targets are a multi-select |
| /targets | user | list, create form built from `channelDescriptors`, test button |
| /admin/users | admin | users, expandable to show their alerts |
| /admin/events | admin | event table with a category filter |
| /admin/deliveries | admin | table with status and channel filters and a retry button |
| /admin/settings | admin | switches for sources and channels |
| /admin/metrics | admin | three small cards or tables |

- `authStore` loads `/api/auth/me` once and keeps the user in a signal.
- `authGuard` and `adminGuard` protect the routes. The server checks access again on every request.
- The events and deliveries pages refresh every 10 seconds and have a manual refresh button.

## Configuration

`.env.example`:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://alerts:alerts@localhost:5432/alerts
JWT_SECRET=replace-with-at-least-32-random-characters
SMTP_HOST=localhost
SMTP_PORT=1025
MAIL_FROM=alerts@example.local
SLACK_WEBHOOK_ALLOWED_PREFIXES=https://hooks.slack.com/services/,http://localhost:3000/api/dev/mock-slack/
WORKER_POLL_MS=2000
DELIVERY_MAX_ATTEMPTS=5
DELIVERY_BACKOFF_BASE_MS=30000
SOURCE_MIN_INTERVAL_MS=20000
SOURCE_MAX_INTERVAL_MS=60000
SEED_ADMIN_EMAIL=admin@example.local
SEED_ADMIN_PASSWORD=admin-password-123
SEED_USER_EMAIL=user@example.local
SEED_USER_PASSWORD=user-password-123
```

`docker-compose.yml` runs `postgres:18-alpine` on port 5432 and `axllent/mailpit` on ports 1025 and 8025.

## Tests

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | `matchesFilters` with a table of cases per category, severity mapping, `computeBackoff`, Slack URL allowlist with hostile URLs such as `https://hooks.slack.com.evil.com/` and `https://evil.com/?https://hooks.slack.com/services/`, password hash and verify |
| Integration | Vitest with `app.inject()` against a separate `alerts_test` database | register and login, 404 on another user's alert, 403 for a user on admin routes, inject event to delivery rows, rerunning the matcher creates no duplicate, worker sends to Mailpit and the mock receiver, fail mode leads to `failed` then `dead` with base backoff 0, admin retry |
| End to end | Playwright | the demo user signs in, creates a Slack target with the mock URL and a market alert, an event is injected, the mock receiver gets the message, the admin sees the delivery as `sent` |

Integration tests read Mailpit through its REST API at `http://localhost:8025/api/v1/messages`.

## Known limits

- Delivery is at least once. See Delivery states.
- Matching loads every enabled alert in the event's category. This is fine for thousands of alerts. Beyond that, coarse filters should move into SQL.
- Timers live in one process. Several API processes would each run the scheduler and create extra events. The worker is safe with several processes because of `SKIP LOCKED`.
- The mock Slack receiver stores messages in memory and loses them on restart.
