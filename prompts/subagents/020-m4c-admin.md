# 020 Implement M4, part c: admin pages

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. The prompt keeps one area per run, tells the implementer not to start dev servers, and ends with the implementer block.

```text
You are the implementer for part c of milestone M4 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/, apps/api, libs/shared or libs/ui.

Read first: AGENTS.md; requirements R12 to R16 in docs/requirements.md; the "Web app" section and the Admin table and metrics example under "HTTP API" in docs/design.md; libs/shared/src/lib/admin.ts and the DTO types it uses; apps/api/src/admin/routes.ts for the exact responses and error codes; task 5 of prompts/subagents/017-m4a-shell-auth.md for the visual direction and the patterns to avoid; every file under apps/web/src, especially the targets and alerts pages from part b, whose patterns you follow.

Environment: Node 26, Angular 22.3, spartan-ng 1.10.1. Selects and checkboxes are plain elements styled with apps/web/src/app/layout/form-classes.ts, because the spartan versions need a package the npm registry does not serve. No Docker access. Never print .env.

Tasks:

1. An admin API service in apps/web/src/app/core, typed with @alerts/shared.

2. /admin/users: a table with email, role, alert count and created date. Selecting a user, with a button in the row, shows that user's alerts in a second table below: name, category, filter summary, minimum severity, enabled. Reuse the filter summary from the alerts page.

3. /admin/events: a category select with "All categories", and a table with time, category, title, severity and source. A Refresh button reloads the list. No timer.

4. /admin/deliveries: status and channel selects with an "All" option, then a table with time, status, channel, event title, alert name, target name, user email, attempts and last error. Status is a badge with a distinct colour per status: sent green, failed amber, dead red, skipped grey, pending and sending neutral. Rows with status failed, dead or skipped have a Retry button. A 409 shows "This delivery can no longer be retried." A Refresh button reloads the list.

5. /admin/settings: two sections, Sources and Channels. Each row has the id, the category for sources, and a switch that calls PATCH. A failed PATCH puts the switch back and shows the error.

6. /admin/metrics: three cards for the last 24 hours: events per category, deliveries per status, and failure rate per channel as a percentage with one decimal. Show the "since" time. A Refresh button reloads.

7. Keep the visual direction from 017 task 5. Every control has a label tied to it. Each page has one h1. Times use the browser's locale with date and time.

8. Tests with Vitest, next to the code:
   - deliveries: a Retry button only on failed, dead and skipped rows; Retry calls POST /api/admin/deliveries/:id/retry and reloads; a 409 shows the message.
   - settings: a failed PATCH puts the switch back.
   - metrics: failure rate 0.125 shows as 12.5%.
   - users: selecting a user loads GET /api/admin/alerts?userId=<id>.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- git status --short
Do not start dev servers. The orchestrator checks the pages in a browser.

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added or changed.
2. Test count per new spec file.
3. Command results, one line each.
4. Deviations from the design or this prompt, and why.
5. What you could not verify.
```
