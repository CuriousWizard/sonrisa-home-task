# M3 review by reviewer-opus (Claude Opus 5.5)

Prompt: `prompts/subagents/014-review-m3.md`. The text below the line is the reviewer's reply, word for word.

---

### Findings

| ID | Severity | Location | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| F1 | minor | apps/api/src/targets/routes.ts:93 | `POST /targets/:id/test` sends right away and has no rate limit. Email addresses are not verified, so any signed-in user can make the server send unlimited mail to any address, or unlimited Slack posts. The out-of-scope item covers alert notifications, not this on-demand send. | Only the auth routes set `config.rateLimit` (auth/routes.ts:21) | Add `config: { rateLimit }` to the test route, or list this gap in "Known limits" |
| F2 | minor | apps/api/src/admin/routes.spec.ts:112 | No test proves that `requireAdmin` reads the role from the database. Both sessions are signed with the row's own role, so a guard that read the token's `role` claim would still pass. | Lines 112–113 | Sign `{ id: user.id, role: 'admin' }` for a user row and expect 403 |
| F3 | minor | apps/api/src/auth/routes.ts:24 | No test covers the cookie attributes or the auth rate limit. Removing `httpOnly`, `sameSite` or `config.rateLimit` would pass the whole suite. | The spec raises the limit to 1000 (routes.spec.ts:22) and never expects 429 | Assert `httpOnly` and `sameSite: 'Strict'` on the cookie. Add one test with `AUTH_RATE_LIMIT_MAX=2` that expects 429 |
| F4 | nit | apps/api/src/auth/routes.spec.ts:133 | `me(cleared.value)` sends an empty cookie, so it returns 401 whatever logout does. | Line 133. `requireUser` returns 401 for a falsy token | Remove the line. The Set-Cookie assertions already test logout |
| F5 | nit | apps/api/src/delivery/worker.spec.ts:327 | The test passes without `skipLocked`. The second claim waits on the row lock, then the re-check sees `sending` with a future lease and drops the row. The test covers `FOR UPDATE`, not `SKIP LOCKED`. | worker.ts:91 and Postgres READ COMMITTED re-check semantics | Rename the test, or hold a row lock in a separate transaction and assert that the tick claims another row without waiting |
| F6 | nit | docs/design.md:229 | The Slack payload text does not mention the `&`, `<` and `>` escaping. | slack.ts:32 | Add "with `&`, `<` and `>` escaped" |
| F7 | nit | docs/design.md:46, docs/decision-log.md | Two deviations are not recorded: the `FOR KEY SHARE` locks, and jose in place of @fastify/jwt, which prompt 007 named. | ingest.ts:66. Grep finds no "jose" or "key share" in docs | Add "for key share" to the event-flow select step. Add a decision entry for jose |
| F8 | nit | docs/design.md:77 | The layout lists `routes, service` for targets and alerts and an auth "plugin". The code has no service files and uses `auth/guards.ts`. It also has `db/registry-sync.ts` and `http-error.ts`, which the layout does not list. | `list_dir` of `apps/api/src` | Update the layout |
| F9 | nit | commit 50d61a3 | The scope is `api`, but the commit also changes `scripts/setup.mjs` and the root `package.json`. | `git log --name-only` | Leave the scope empty for commits that span projects |

### Verified

- **Crash during the fifth attempt:** pending → sending(1) → failed → sending(2) → failed → sending(3) → failed → sending(4) → failed → sending(5) → crash → the lease expires → `expireLeasesAtMax` sets dead with `lease expired`. The claim requires `attempts < max`, so no sixth send happens.
- **Five failed sends:** the same path ends with sending(5) → dead with the channel error. `computeBackoff(row.attempts)` gives waits of 30, 60, 120 and 240 s, plus up to 10%.
- **Slow send that outlives its lease:**
  - Worker A holds sending(n). The lease expires, and worker B claims the row as sending(n+1) and records sent, failed or dead.
  - A's later update fails the `attempts` fence and is logged at debug level. The message can go out twice, which the at-least-once design accepts.
  - In one process this cannot happen, because ticks never overlap. It needs a second process.
  - If n equals the maximum, B does not claim the row and it is marked dead. A's success is then dropped, so a message that was sent shows as dead. This is an accepted edge case.
- **Ingest:**
  - The event insert, alert select, channel read and delivery insert run in one transaction.
  - A repeated `(source, external)` pair returns null. Deliveries use `ON CONFLICT DO NOTHING` on the alert, event and target triple.
  - A disabled channel gives `skipped` with 0 attempts and `channel disabled`. SQL filters out disabled alerts, and a test covers it.
- **Deviations:**
  - **jose:** sound. HS256 is pinned, `exp` is checked, `sub` is parsed as a uuid, and the role claim is never used.
  - **Per-route preHandler:** sound. All 10 admin routes have `adminOnly`, and the `onRoute` test would catch a route without it.
  - **`FOR KEY SHARE` locks:** sound. They allow concurrent `NO KEY UPDATE`, and deletes wait, so a foreign key error cannot roll back the event insert.
  - **Slack escaping:** sound. It matches Slack's documented escaping.
  - **Design impact:** only F6 and F7.
- **Security:**
  - scrypt with `timingSafeEqual` and a dummy hash for unknown emails.
  - The cookie is HttpOnly, SameSite=Strict, Path=/, and Secure in production.
  - Every target and alert query filters by `user_id`. `targetIds` ownership is checked under a lock.
  - The Slack allowlist runs on create and before each send, with `redirect: 'error'`. Fetch and SMTP errors carry no URL or credentials.
  - 500 responses hide the message. The `text/plain` parser is removed.
  - Every body, query and params object goes through a shared zod schema.
  - The only `sql.raw` call uses enum constants. Dev routes are registered only outside production, and a test checks for 404.
- **Extension:** a channel needs a shared map entry, a module and a registry entry. A source needs a module and a registry entry.
- **Packages:** every version exists on npm. The cookie and rate-limit plugins require Fastify 5.x, and fastify 5.12.8 is installed. pg needs Node 16 or later and nodemailer Node 20 or later, and nodemailer ships its own types. @fastify/jwt is not left in package.json.
- **Unit tests:** the 9 specs that need no database pass, 104 tests in total. The match cases for `C++`, `boil`, `1.0` and an earthquake without a magnitude, the Slack redirect body count, and the worker fence and lease-expiry tests would each fail without their rule.
- **Commits:** all six are `feat(api)` with a lowercase imperative summary, no final period, and a body that explains why.

### Not verified

- I read the specs that use the database but did not run them, as the review constraints require.
- I did not start the API or repeat the end-to-end run.
- I did not rerun build and lint. The terminal is shared with the other reviewer, and some command output came back mixed with theirs.
- `npm view` returned no `engines` field for jose 6.2.18. Whether it runs on Node 26 rests on the build the orchestrator reported.
