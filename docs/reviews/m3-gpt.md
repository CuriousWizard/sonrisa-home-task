# M3 review by reviewer-gpt (GPT-6.2 Sol)

Prompt: `prompts/subagents/014-review-m3.md`. The text below the line is the reviewer's reply, word for word.

---

### Findings

| ID | Severity | Location | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| M3-01 | major | [apps/api/src/app.ts:94](apps/api/src/app.ts#L94) | Failed database writes can put Slack webhook URLs and password hashes in logs. The generic 500 only protects the response. | A dummy `DrizzleQueryError` included its bound parameter in `message`; the handler logs the whole error. | Log request IDs and safe database error codes, not raw database errors or causes. Apply the same rule to the seed script. |
| M3-02 | major | [apps/api/src/delivery/worker.ts:154](apps/api/src/delivery/worker.ts#L154) | Admin retry can make an old claim look current. If attempt 1 stalls and attempt 2 fails, retry resets the counter. Once the new attempt 1 starts, the original attempt 1 can overwrite its state. | [Retry resets `attempts`](apps/api/src/admin/routes.ts#L156); the result update matches only ID, status and attempt count. | Assign a unique claim ID and require it on result writes. Keep the attempt count for backoff. Update the design. |
| M3-03 | major | [apps/api/src/delivery/worker.ts:178](apps/api/src/delivery/worker.ts#L178) | A slow send holds back result writes for the whole batch. A second worker can reclaim even a row whose send already succeeded. The SMTP timeouts do not enforce a total send deadline. | The worker waits for all sends before writing; [Nodemailer](https://nodemailer.com/smtp) defines `socketTimeout` as idle time. Config accepts any positive lease. | Persist each result as it settles. Enforce a cancellable send deadline below the lease, or renew the lease while a send is active. Correct the design’s deadline claim. |
| M3-04 | minor | [apps/api/src/targets/routes.ts:31](apps/api/src/targets/routes.ts#L31) | Target and alert lists ignore `limit`, including the admin user-alert list. Routes with no declared inputs also ignore unexpected query strings and, on bodyless POSTs, JSON bodies. | [Alert listing](apps/api/src/alerts/routes.ts#L50), [logout](apps/api/src/auth/routes.ts#L80), and the [design’s list contract](docs/design.md#L269). | Apply `ListQuery` to unbounded lists. Validate empty inputs or document which inputs are intentionally ignored. |
| M3-05 | minor | [apps/api/src/auth/password.ts:8](apps/api/src/auth/password.ts#L8) | The scrypt cost meets prompt 007 but falls below OWASP guidance. | At `N=16384, r=8`, [OWASP recommends `p=5`](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt); the code uses `p=1`. | Benchmark a recommended configuration and upgrade existing hashes on login. |
| M3-06 | minor | [apps/api/src/auth/session.ts:28](apps/api/src/auth/session.ts#L28) | The signer sets an expiry, but the verifier does not require the claim. | The same JOSE options accepted a correctly signed synthetic token without `exp`. | Require `exp` explicitly in `jwtVerify`. |
| M3-07 | minor | [apps/api/src/delivery/worker.spec.ts:282](apps/api/src/delivery/worker.spec.ts#L282) | The stale-result test changes `attempts` directly, so it checks the ordinary fence but not a real reclaim. The two-worker test can pass without `SKIP LOCKED`: waiting for the lock can still avoid a duplicate. | [Two-worker assertion](apps/api/src/delivery/worker.spec.ts#L327) counts sends after both ticks finish. | Drive two real claims in the stale-result spec. Assert the second claim makes progress while another eligible row is locked. |
| M3-08 | minor | [apps/api/src/alerts/routes.spec.ts:256](apps/api/src/alerts/routes.spec.ts#L256) | Two tests can pass with the wrong implementation: the PUT fixture keeps `enabled: true`, and the metrics fixture gives events identical creation and occurrence timestamps. | [PUT replacement](apps/api/src/alerts/routes.spec.ts#L266); [metrics fixture](apps/api/src/admin/routes.spec.ts#L209). | Flip `enabled` in the replacement and put the two timestamps on opposite sides of the cutoff. |

### Verified

- **Fifth-attempt crash:** `pending → sending(1) → failed(1) → sending(2) → failed(2) → sending(3) → failed(3) → sending(4) → failed(4) → sending(5) → dead` on lease expiry. No sixth send.
- **Five failed sends:** Same sequence through `sending(5)`, then `dead` on failure. Default retry waits are 30, 60, 120 and 240 seconds plus jitter.
- **Slow send and direct reclaim:** `sending(n) → sending(n+1) → sent, failed or dead` according to the new result. Both sends can reach the destination; the old result cannot change the row unless the counter is reused as in M3-02.
- **Ingest:** One transaction stores the event and its deliveries. Both dedup keys have unique constraints. Disabled alerts produce no rows; a channel read as disabled produces `skipped`, with zero attempts. Queued rows wait while disabled. `FOR KEY SHARE` protects against concurrent deletes, not edits; document that distinction.
- **Security and deviations:** All ten admin routes use the database-backed role guard. Per-route guards and `jose` preserve the intended authorization and cookie behavior, subject to M3-06. Ownership predicates, parameterized SQL, per-IP auth limits, production dev-route exclusion, Slack revalidation and redirect refusal are in place. Channel errors and admin DTOs omit secrets. Document Slack escaping and prompt 013’s intentional 404 for an unknown retry ID; neither needs a code change.
- **Checks:** 104 database-free tests passed on Node 26.13.1. All 66 manifest minimum versions exist; no declared engine range rejects Node 26. Both Fastify plugins declare 5.x support. Channel and source registration follow the extension contract. All six commit messages comply.

### Not verified

- Database-backed specs, live API behavior and mutation runs were not executed under the shared-database and no-edit constraints. The state traces and test findings are from code inspection.
