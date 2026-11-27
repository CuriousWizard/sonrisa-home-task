# 013 Implement M3, part d: admin routes

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer for part d of milestone M3 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit only apps/api.

Read first: AGENTS.md; requirements R12 to R16 in docs/requirements.md; in docs/design.md the "Admin" table and the metrics example under "HTTP API", the "Delivery states" section (admin retry) and the "Security" table; libs/shared/src/lib/admin.ts, common.ts, params.ts and the DTO types; every file under apps/api/src. Follow the route and spec patterns already there.

Environment: Postgres at 127.0.0.1:5432. No Docker access; do not run docker commands. Never print .env. Tests use TEST_DATABASE_URL and run one file at a time.

Tasks:

1. Admin routes under /api/admin, every one behind requireAdmin, as in the design's Admin table. Parse every query and params object with the shared schemas. Lists return the newest rows first and honour limit.
   - GET /users: users with their alert count. Never return password_hash.
   - GET /alerts?userId=: that user's alerts as AlertDto with targetIds.
   - GET /events?category=&limit=
   - GET /deliveries?status=&channel=&limit=: each row with event title, alert name, target name and user email. Never return the target config, because it holds the webhook URL.
   - POST /deliveries/:id/retry: one conditional UPDATE ... WHERE id = :id AND status IN ('failed', 'dead', 'skipped') RETURNING. It sets pending, attempts 0, next_attempt_at now() and last_error null. No row back gives 404 if the id does not exist and 409 otherwise.
   - GET /sources and PATCH /sources/:id with PatchEnabled; GET /channels and PATCH /channels/:id with PatchEnabled. An unknown id is 404.
   - GET /metrics: rows created in the last 24 hours. eventsByCategory has a key for every Category. deliveriesByStatus has a key for every DeliveryStatus. failureRateByChannel has a key for every channel in the channel registry, with dead / (sent + dead), and 0 when both are 0. Keys with no rows are 0.

2. Tests with Vitest and app.inject:
   - every admin route returns 401 without a session and 403 for a user session. Loop over the route list so a new route cannot skip the check.
   - users list has no password_hash field anywhere in the body.
   - deliveries list has no config or webhookUrl field anywhere in the body, and filters by status and channel.
   - retry: failed, dead and skipped become pending with attempts 0; sent and pending give 409; an unknown id gives 404.
   - PATCH a channel to disabled, then GET shows it disabled; restore it after the test.
   - metrics: with known rows inserted, the counts and the failure rate are right, and rows older than 24 hours are left out.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- remove requireAdmin from one route; report which test fails; restore
- start the API with npx nx serve api; log in as the seeded admin; call GET /api/admin/metrics and GET /api/admin/deliveries?limit=3 and report the status codes and the metrics body; log in as the seeded user and report the status of GET /api/admin/users; stop the server and any processes it left
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added or changed.
2. Test count per file.
3. Command results, one line each.
4. Deviations from the design or this prompt, and why.
5. What you could not verify.
```
