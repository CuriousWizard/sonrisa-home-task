# 014 Review M3

Sent to: `reviewer-opus` and `reviewer-gpt`, in parallel, with the same text. Both reviewer files now carry the body from D-029.

```text
Review milestone M3 in /home/davidt/project/sonrisa-home-task. M3 is the backend. It is committed as six commits: git log --oneline d637df1..HEAD and git diff d637df1..HEAD -- apps/api scripts package.json. Ignore package-lock.json, node_modules, dist, tmp, .nx and .angular.

Context:
- The contract is docs/design.md and docs/requirements.md. The implementer prompts are prompts/subagents/007 to 013. The orchestrator split M3 into parts because long implementer runs returned no report (V-011 in docs/ai-review-log.md).
- Out of scope for M3: the web app, API integration tests beyond the specs that exist, and Playwright. Do not report their absence.
- The orchestrator already verified: npx nx run-many -t build lint test passes for 6 projects with 157 API tests; an end-to-end run where an injected earthquake of magnitude 7.1 matched a disaster alert and reached both the mock Slack receiver and Mailpit, while magnitude 5.5 created no delivery; a Slack target on https://hooks.slack.com.evil.com/services/x was rejected with 400.
- Known deviations the implementers reported: jose signs the session JWT instead of @fastify/jwt; admin routes use a per-route preHandler; ingest and alert writes take FOR KEY SHARE locks; the Slack channel escapes &, < and >.

Constraints for this review:
- Two reviewers run at the same time on one test database. Do not run any spec that touches the database, and do not start the API. You may run pure unit specs, such as apps/api/src/matching/match.spec.ts, channels/slack-url.spec.ts and delivery/backoff.spec.ts, with npx vitest run --config apps/api/vitest.config.mts <file>.
- No Docker access. Never print .env.

Check in particular:
1. The delivery worker against "Delivery states" in the design: list each state a row passes through for a crash during the fifth attempt, for five failed sends, and for a slow send that outlives its lease while a second tick claims the row.
2. Ingest and matching: dedup, skipped rows for a disabled channel, rows for a disabled alert, and the transaction boundaries.
3. Security against OWASP Top 10: session cookie and JWT verification, the role check on every admin route, object ownership on targets and alerts, the Slack URL allowlist and redirect handling, secrets in error messages and responses, rate limiting, input validation on every body, query and params object, and the dev routes in production.
4. Each known deviation above: is it sound, and does the design need an update?
5. Tests: would each test fail if its rule were removed? Name tests that pass for the wrong reason.
6. Package names and versions in package.json and apps/api/package.json: they exist and fit Node 26 and Fastify 5.
7. The six commit messages against the rules in AGENTS.md.

Do not edit files. Use the output format from your agent instructions. Keep the review under 900 words.
```
