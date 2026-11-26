# M1 design review by reviewer-gpt (GPT-6.2 Sol)

Prompt: `prompts/subagents/001-review-design.md`. The text below the line is the reviewer's reply, word for word.

---

### Findings

| ID | Severity | Location | Finding | Evidence | Suggested fix |
|---|---|---|---|---|---|
| F1 | major | [docs/design.md:154](docs/design.md#L154) | **R10:** An expired fifth claim permits a sixth send. A slow worker can also overwrite a newer result. | Claim increments attempts without a cap. `SKIP LOCKED` protects the claim transaction, not the send. Completion has no ownership check. | Atomically claim and commit before I/O. Mark expired final claims `dead`; fence completion with a claim token. Set send deadlines below the lease, including SMTP, and claim only work that can start promptly. |
| F2 | major | [docs/design.md:158](docs/design.md#L158) | **R3, R11, R14:** The worker consumes an attempt before skipping. The diagram lacks `sending → skipped`. Direct test sends do not specify whether the channel switch applies. | The claim increments first; the test route bypasses the queue; retry has no atomic status guard. | Insert disabled-channel rows as `skipped` with zero attempts and a reason. Define and test disable behavior for queued, reclaimed and test sends. Make admin retry a conditional update. |
| F3 | major | [docs/design.md:108](docs/design.md#L108) | **R5, R17:** The listed `AlertFilters` and `EventData` branches lack the discriminator their schemas require. The alert route instead requires a second `category` inside `filters`. | The shared shapes and `filters.category` rule disagree. Earthquake `magnitude` is optional, and news adds whole-word and empty-list semantics that R5 does not settle. | Discriminate the outer alert/event DTO on `category`; keep inner payloads untagged. Define missing magnitude behavior and confirm news matching semantics. |
| F4 | major | [docs/design.md:207](docs/design.md#L207) | **N3:** Adding a channel requires a seed edit as well as registration; adding a source faces the same problem. The metrics example also fixes the channel keys. | D-020 promises no extra edits; settings rely on seeded rows. | Derive IDs, settings rows and metric keys from registries. Upsert defaults without resetting admin choices. |
| F5 | major | [docs/design.md:228](docs/design.md#L228) | **Cookie JWT:** The sample secret passes the length check. Cookie path is unspecified, and logout does not revoke a stolen token. SameSite alone does not establish same-origin. | Session/CSRF table and config example; bodyless mutations have no stated origin policy. | Reject placeholder secrets; require random key material, cookie-only HS256 verification and the current DB role. Set and clear a host-only cookie with an explicit path. Check Origin for browser mutations and document logout’s replay window. |
| F6 | major | [docs/design.md:234](docs/design.md#L234) | **N4:** Default Slack matching and redirect refusal are sound, but custom prefixes have no startup validation. Raw send errors can expose webhook secrets; non-2xx handling is implicit. | Prefix comparison, development HTTP entry, and raw error storage/test response. | Validate exact origins and slash-delimited paths; reject userinfo and restrict HTTP to the development mock. Treat non-2xx as failure. Redact URLs, cookies and credentials from logs/errors. |
| F7 | minor | [docs/design.md:239](docs/design.md#L239) | **R2, R4, R14:** Deleting an alert or target leaves delivery history and retry behavior undefined. Timestamp-only pagination can omit rows with tied timestamps. | Delivery list joins current entities; no delivery deletion policy or cursor tie-breaker. | Specify retained history and retry eligibility after deletion. Use `(created_at, id)` cursors where pagination matters. |
| F8 | minor | [docs/design.md:221](docs/design.md#L221) | **R7, R17, R18, N1, N5:** Timing does not explicitly require a fresh random delay. Injection omits metadata defaults; the mock accepts “any JSON” despite the shared-schema rule. Startup and seed commands are absent. | Scheduler, dev routes and test plan. `app.inject()` does not open the socket the webhook sender needs. | Specify random scheduling, generated event metadata, a bounded shared mock DTO, local commands, and a loopback listener for outbound integration tests. |
| F9 | minor | [docs/requirements.md:76](docs/requirements.md#L76) | Rate limiting is out of scope, but the design throttles auth. | Requirements versus security table. | Keep auth throttling; clarify that notification throttling is out of scope. |
| F10 | minor | [docs/decision-log.md:85](docs/decision-log.md#L85) | **Two-hour scope:** Metrics UI, browser setup and settings UI compete with the first end-to-end delivery. | D-014 gives the cut order; the design also adds auto-refresh and custom pagination. | Cut metrics UI first, then Playwright, then settings UI; record R16/N5/R15 deferrals. Use manual refresh and simple lists. Keep both channels and queue/retry tests. |

### Verified

- Covered at contract level: **R1, R6, R8, R9, R12, R13, R15, R16 and N2**. Same-category matching, severity, the unique delivery key, owner scoping and server-side admin checks are explicit.
- Delivery walkthrough: claim 1 sets `sending` with a 60-second lease. A crash leaves it there; the next due poll claims attempt 2 and may duplicate a send already accepted. Without crashes, failures 1–4 set `failed` with delays of 30, 60, 120 and 240 seconds plus jitter; failure 5 sets `dead`. Admin retry resets to `pending`, zero attempts, due now, with the error cleared.
- Cached `npm view` and upstream docs confirm Fastify 5 compatibility for JWT 10.2.9, cookie 11.1.5 and rate-limit 11.3.0. The Zod provider 7.0.0 declares Fastify `^5.5.0` and Zod `>=4.1.5` (use Zod 4).
- Drizzle 0.45.4 accepts `postgres` ≥3 or `pg` ≥8. Published engines for `postgres` 4.1.1, `pg` 8.23.1 and Nodemailer 10.6.1 admit Node 26. Node 26 rejected a loopback redirect with `redirect: 'error'`; Mailpit’s Swagger lists `GET /api/v1/messages`.
- Recent docs commits follow the convention; D-011 records the earlier `chore` exception.

### Not verified

- Live npm registry lookup failed DNS; metadata came from the local cache. No application exists to verify runtime security, dependency integration or test behavior.
