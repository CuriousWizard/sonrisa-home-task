# 027 Apply M5 review findings

Sent to: default implementer subagent. Findings from `docs/reviews/m5-opus.md` (F1, F2, F5) and `docs/reviews/m5-gpt.md` (M5-01 to M5-05). Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer for review fixes to the M5 tests in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Edit only apps/api/src/pipeline.integration.spec.ts and the files under apps/web-e2e. Do not change application code; if a fix seems to need it, report it instead.

Read first: docs/reviews/m5-opus.md and docs/reviews/m5-gpt.md; apps/api/src/pipeline.integration.spec.ts; apps/web-e2e/playwright.config.mts, project.json and src/smoke.spec.ts; apps/api/src/delivery/message.ts, whose subject is "[<category>] <title>".

Environment: Postgres and Mailpit run. Chromium for Playwright is installed. Ports 3000 and 4200 are free. No Docker access. Never print .env.

Changes to the e2e test:
1. F1 and M5-02. Other alerts in the dev database can match the injected event, so the count is not this test's to own. Assert deliveriesCreated is at least 1. Give the alert one unique symbol, "E" followed by 7 characters of the suffix in uppercase, and inject the event with that symbol. Before the test, sign in as the user through page.request and delete every alert and target whose name starts with "E2E ", so a run that failed to clean up cannot break the next one.
2. M5-03. The Slack poll waits for a message on the hook whose text contains the injected event title. After the alert is created, read it back through GET /api/alerts and assert its saved filters: the one symbol, direction any, minChangePct 5.
3. M5-04. Give each poll 30 seconds and the test 90 seconds. After each Refresh click on the deliveries page, wait for the GET /api/admin/deliveries response before checking the row.
4. F5. Correct the comment in playwright.config.mts: under npm run e2e, Nx starts both servers as dependencies and Playwright reuses them; gracefulShutdown applies only to a direct npx playwright test. Turn caching off for the inferred e2e-ci targets as well.

Changes to the pipeline spec:
5. F2 and M5-01. Enable every channel in beforeAll. In scenario 4, move the disable call inside the try, so the finally block restores the switch even if the disable step fails. Run each teardown step on its own, so one failure does not skip the rest: turn fail mode off, delete users, delete events, close the app, close the pool.
6. M5-05, in part. Give the Mailpit wait an explicit timeout of 5 seconds and the tests that wait on it an explicit timeout of 15 seconds. Keep the free-port probe: the channel registry needs the allowlist prefix, with the port, before the app can listen.
7. M5-03, in part. In scenario 1, also assert that the Mailpit subject and the mock Slack text contain the injected event title.

Verification you must run, and report each in one line:
- npx vitest run --config apps/api/vitest.config.mts apps/api/src/pipeline.integration.spec.ts, twice
- npm run e2e, twice
- start npm run dev in the background, wait until http://localhost:4200 answers, run npm run e2e once, and report what happens; then stop every process you started and confirm ports 3000 and 4200 are free
- npx nx run-many -t build lint test --skip-nx-cache
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files changed.
2. Command results, one line each, including what npm run e2e does while npm run dev runs.
3. Deviations from this prompt, and why.
4. What you could not verify.
```
