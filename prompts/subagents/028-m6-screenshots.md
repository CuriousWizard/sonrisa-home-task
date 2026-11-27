# 028 Implement M6: README screenshot script

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. The user chose to commit the script in `scripts/` (prompt log 014).

```text
You are the implementer for the README screenshot script of milestone M6 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/ other than adding docs/screenshots/, and do not edit prompts/, AGENTS.md, .github/, apps/ or libs/. Add scripts/screenshots.mjs and the PNG files, and add one script to the root package.json.

Read first: AGENTS.md; the "Delivery states", "Dev only" and "Web app" sections of docs/design.md; scripts/setup.mjs, whose style the new script follows; apps/web-e2e/src/smoke.spec.ts, which signs in through the API and drives the same pages; apps/api/src/admin/ and apps/api/src/dev/ for the routes and response shapes; libs/shared/src/lib/ for the request bodies; the page templates under apps/web/src/app for the routes and labels.

Environment: Playwright 1.65.1 with Chromium in ~/.cache/ms-playwright; a headless launch from the shell works. Postgres and Mailpit run. The dev database is seeded with admin@example.local / admin-password-123. Ports 3000 and 4200 are free. No Docker access. Never print .env. If another process already listens on port 3000 or 4200, stop and report it instead of killing it.

Goal: one command that fills the dev stack with readable demo data and saves six screenshots for the README. A reader must be able to run it again and get the same pictures.

Tasks:

1. scripts/screenshots.mjs, plain ESM JavaScript run with node, importing chromium from @playwright/test. Root package.json gets "screenshots": "node scripts/screenshots.mjs".

2. Preconditions. The script expects npm run dev to be running with DELIVERY_BACKOFF_BASE_MS=2000 in the shell environment, so a delivery reaches dead in under a minute. Shell variables win over .env for both Nx and process.loadEnvFile; check that this holds. The script exits with a clear message if http://localhost:4200 does not answer. Put the expected command in a comment at the top of the file.

3. Accounts. Use a dedicated account, screenshots@example.local with password screenshots-password-123: sign in, and register it if the sign-in returns 401. Do not touch the seeded demo user's data. Use one browser context per account and sign in with context.request, so the pages share the session cookie. The sign-in route allows 10 requests per minute per IP, so sign in once per account.

4. Known state before the data. As admin, read the source and channel switches and remember them. Disable every source, so timer events do not add rows to the screenshots. Enable both channels. Turn mock Slack fail mode off. Delete every alert, then every target, of the screenshot account.

5. Data, all through the API:
   - Targets: "Work email" with address screenshots@example.local, and "Team Slack" with http://localhost:3000/api/dev/mock-slack/screenshots.
   - Alerts, with realistic names and filters: a disaster alert for earthquakes in Asia with minimum magnitude 6 and minimum severity 3 on both targets; a market alert on a few large tech symbols, direction any, minimum change 5, on both targets; a news alert on keywords such as oil and OPEC, minimum severity 4, on the email target, left disabled so the list shows a switch that is off.
   - Event S: an earthquake in Asia that matches. Wait until both of its deliveries are sent.
   - Turn fail mode on. Event A: a market move that matches. Wait until its Slack delivery is dead and its email delivery is sent. If the Slack row is not dead within 120 seconds, exit with a message that names DELIVERY_BACKOFF_BASE_MS=2000.
   - Event B: another market move that matches. As soon as its Slack delivery is failed, disable the Slack channel. A disabled channel holds a failed row in place, so the screenshot shows it as failed.
   - Event C: another earthquake that matches while Slack is off. Its Slack row is skipped. Wait until its email row is sent.
   - Use event titles that read like real headlines. Read statuses from GET /api/admin/deliveries, matched by event title and channel. Poll with a deadline; never sleep a fixed time and hope.

6. Screenshots to docs/screenshots/, viewport 1440 by 900, light theme as the app renders it, PNG. Wait for each page's data to load before the shot:
   - 01-sign-in.png: /login in a context with no session.
   - 02-alerts.png: /alerts as the screenshot account.
   - 03-alert-form.png: the edit page of the earthquake alert.
   - 04-targets.png: /targets.
   - 05-admin-deliveries.png: /admin/deliveries as admin, with sent, failed, dead and skipped rows visible.
   - 06-admin-metrics.png: /admin/metrics as admin.
   Use fullPage only where the content does not fit the viewport.

7. Restore in a finally block, each step on its own so one failure does not skip the rest: fail mode off, both channels and every source back to the states read in step 4, browser closed. Leave the screenshot account's alerts and targets in place, so a reader can open them in the app. The next run deletes them in step 4.

8. Print one line per screenshot and one line per wait with its duration.

Verification you must run, and report each in one line:
- Start the dev stack in the background with DELIVERY_BACKOFF_BASE_MS=2000 npm run dev, using setsid so you can stop the whole group, and wait until http://localhost:4200 answers.
- npm run screenshots, twice in a row. Both runs pass, and the second run produces the same set of rows on each page.
- After the second run, confirm through the API that the source switches, the channel switches and fail mode match their state before the first run.
- Look at each PNG with your image tool if you have one, and report what each one shows in one line. If you have no image tool, say so.
- npx prettier --check scripts/screenshots.mjs package.json
- Stop every process you started, including the esbuild and @angular/build children, and confirm ports 3000 and 4200 are free.
- npx nx run-many -t build lint test --skip-nx-cache
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added or changed.
2. Command results, one line each, with the duration of each screenshot run.
3. What each screenshot shows.
4. Deviations from this prompt, and why.
5. What you could not verify.
```
