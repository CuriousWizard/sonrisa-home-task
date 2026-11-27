# 016 Apply M3 review findings, part 2: security and tests

Sent to: default implementer subagent, after prompt 015 finished. Findings: reviewer-gpt M3-01, M3-04, M3-05, M3-06 and M3-08; reviewer-opus F1 to F4. Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer for review fixes to security and tests in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit only apps/api. Do not touch apps/api/src/delivery; another change just finished there.

Read first: docs/reviews/m3-gpt.md and docs/reviews/m3-opus.md; the "Security" section of docs/design.md; apps/api/src/app.ts, auth/*, targets/routes.ts, alerts/routes.ts, admin/routes.ts, db/seed.ts, sources/scheduler.ts and their specs.

Environment: Postgres at 127.0.0.1:5432. No Docker access; do not run docker commands. Never print .env. Tests use TEST_DATABASE_URL and run one file at a time.

Changes:

1. Logs without secrets (M3-01). A DrizzleQueryError puts the SQL and the bound parameters in its message, so logging the error object can write a password hash or a webhook URL to the log. Add one helper that turns any error into a safe log object: the error name, the Postgres code and constraint name when the cause is a pg DatabaseError, and the message only for errors that are not database errors. Use it in the app error handler, the scheduler, and seed.ts. Add a test: an error handler log for a failed insert holds neither the parameter value nor the query text.

2. Session tokens must carry exp and sub (M3-06). Pass requiredClaims to jwtVerify. Add a test: a token signed with the right secret but without exp gives 401.

3. scrypt cost (M3-05). OWASP lists N=2^14, r=8, p=5 as one minimum setting. Change p to 5. Stored hashes keep their own parameters, so old hashes still verify; add a test that a hash made with p=1 still verifies.

4. Rate limit on the target test route (F1): the same per-IP limit as the auth routes, from AUTH_RATE_LIMIT_MAX.

5. Lists honour ListQuery.limit (M3-04): GET /api/targets, GET /api/alerts and GET /api/admin/alerts. Leave routes without declared inputs as they are.

6. Tests that pass for the wrong reason:
   - F2: an admin route with a token signed as role admin for a user row returns 403.
   - F3: the session cookie has HttpOnly, SameSite=Strict and Path=/. With AUTH_RATE_LIMIT_MAX=2, the third login in a minute returns 429.
   - F4: remove the me(cleared.value) line in auth/routes.spec.ts.
   - M3-08: the PUT replacement in alerts/routes.spec.ts flips enabled and the test asserts the new value. The metrics fixture in admin/routes.spec.ts gives one event created_at inside the 24-hour window and occurred_at outside it, and another the other way round, and asserts that only created_at counts.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- remove requiredClaims; report which test fails; restore
- log the raw error again in the error handler; report which test fails; restore
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files changed.
2. Command results, one line each.
3. Deviations from this prompt, and why.
4. What you could not verify.
```
