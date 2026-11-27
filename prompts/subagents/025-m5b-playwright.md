# 025 Implement M5, part b: Playwright smoke test

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. The orchestrator installed Playwright's Chromium, and the user installed its system libraries, before this prompt. A headless launch works.

```text
You are the implementer for part b of milestone M5 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/, apps/api, libs/ or apps/web/src. Edit apps/web-e2e, and apps/web/project.json or the root package.json only if the e2e setup needs it.

Read first: AGENTS.md; the "Tests" row "End to end", the "Web app" section and the "Dev only" table in docs/design.md; finding M2-04 in docs/reviews/m2-gpt.md; apps/web-e2e/playwright.config.mts, project.json and src/example.spec.ts; apps/web/proxy.conf.json and apps/web/.env.serve; the templates under apps/web/src/app/auth, targets, alerts and admin, so you know the labels and button names.

Environment: Playwright 1.65.1 with Chromium installed in ~/.cache/ms-playwright; a headless launch works. Postgres and Mailpit run. The dev database is seeded with user@example.local / user-password-123 and admin@example.local / admin-password-123. No Docker access. Never print .env. If another process already listens on port 3000 or 4200, stop and report it instead of killing it.

Tasks:

1. playwright.config.mts:
   - Start both servers: npx nx run api:serve, ready at http://localhost:3000/api/health, and npx nx run web:serve, ready at http://localhost:4200. Keep reuseExistingServer true and allow 180 seconds to start.
   - Remove the CI branch that uses web:serve-static. That server has no /api proxy, so the app cannot reach the API (finding M2-04).
   - Chromium only, one worker, no retries, trace on failure.

2. Replace src/example.spec.ts with src/smoke.spec.ts, one test that follows the design's end-to-end row:
   - The demo user signs in through the sign-in page.
   - On /targets the user adds a Slack target named "E2E Slack <suffix>" with the webhook URL http://localhost:3000/api/dev/mock-slack/e2e-<suffix>.
   - On /alerts/new the user creates a market alert named "E2E market <suffix>": category Market, empty symbols, direction any, minimum change 5, minimum severity 1, the new target checked.
   - The test injects a market event through page.request.post('/api/dev/events') with changePct 8 and the title "E2E move <suffix>", and expects deliveriesCreated 1.
   - expect.poll on GET /api/dev/mock-slack/messages until a message with hook id e2e-<suffix> appears, with a timeout of 20 seconds.
   - The user signs out. The admin signs in, opens /admin/deliveries, and the row for "E2E move <suffix>" shows the status Sent. Use the Refresh button inside an expect.poll if the row is not sent yet.
   - Cleanup in a finally block or afterEach: sign in as the user through page.request and delete the alert and the target through the API, so a second run starts clean.
   - Use role and label locators: getByLabel, getByRole with the visible names. Use the row-level aria-labels from the pages where several rows share a button. Do not use CSS class selectors.
   - <suffix> is a random value per run.

3. npm run e2e must run this test.

Verification you must run, and report each in one line:
- npm run e2e, twice in a row, both passing
- npx nx run-many -t build lint test --skip-nx-cache
- after the runs, confirm that no server processes from Playwright are left running and that ports 3000 and 4200 are free
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added or changed.
2. Command results, one line each, with the e2e duration.
3. Locators that needed a workaround, and why.
4. Deviations from this prompt, and why.
5. What you could not verify.
```
