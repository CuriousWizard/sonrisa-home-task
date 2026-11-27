# 018 Implement M4, part b: targets and alerts pages

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. The 017 run ended early with a progress note ("A quick browser check of the rendered pages:") instead of a report, so this prompt keeps the closing block and drops the browser check, which the orchestrator runs itself.

```text
You are the implementer for part b of milestone M4 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/, apps/api or libs/shared. Edit apps/web, and libs/ui only through the spartan CLI.

Read first: AGENTS.md; the "Web app", "Matching rules" and HTTP API sections for Targets and Alerts in docs/design.md; requirement R2 to R6 in docs/requirements.md; libs/shared/src/lib/alerts.ts, channels.ts, enums.ts and events.ts; apps/api/src/targets/routes.ts and apps/api/src/alerts/routes.ts for the exact responses and error codes; task 5 of prompts/subagents/017-m4a-shell-auth.md for the visual direction and the list of patterns to avoid; every file under apps/web/src.

Environment: Node 26, Angular 22.3, spartan-ng 1.10.1. No Docker access. Never print .env.

Tasks:

1. Add the spartan native-select and checkbox components with NX_DAEMON=false npx nx g @spartan-ng/cli:ui --name=<name> --directory=libs/ui. Part a was asked for them but they are missing. If the CLI fails, report the error and use plain elements styled with the theme classes.

2. API services in apps/web/src/app/core for targets and alerts, typed with the DTOs and inputs from @alerts/shared.

3. /targets:
   - A table of the user's targets: name, channel label from the shared channels map, destination, and actions. The destination is the email address for email. For Slack show only the URL's host, because the path is the secret.
   - Actions per row: "Send test", which shows "Sent" or the error text in the row; "Delete", which asks for a second click before it sends the request. A 409 shows "An alert still uses this target."
   - A create form under the table: name, a channel select built from the shared channels map, then one input per entry in that channel's fields list, with the field's label and input type. Validate with TargetInput.safeParse before sending and show the issues under the fields. Show server errors under the form.
   - Adding a channel to the shared map must not need a change to this page.

4. /alerts:
   - A table: name, category, a one-line summary of the filters, minimum severity, number of targets, an enabled switch that calls PATCH, an Edit link and a Delete action with a second click.
   - A "New alert" link to /alerts/new.
   - An empty state of one sentence plus the link.

5. /alerts/new and /alerts/:id, one form component:
   - Fields: name; category select; the filter fields for the selected category; minimum severity select from 1 to 5; target checkboxes from the user's targets, at least one; enabled.
   - News: keywords as one comma-separated text input. Market: symbols as comma-separated text, a direction select with any, up and down, and a minimum change in percent. Disaster: type checkboxes, region checkboxes with readable names, and an optional minimum magnitude that the form labels as earthquakes only.
   - Changing the category resets the filter fields to that category's defaults.
   - Put the conversion between the form value and AlertInput in plain functions, toAlertInput and fromAlertDto, so they can be tested without the DOM. Validate with AlertInput.safeParse before sending and show the issues next to the fields.
   - If the user has no targets, show one sentence with a link to /targets instead of the form.
   - Edit loads GET /api/alerts/:id and sends PUT. New sends POST. Both go back to /alerts after success.

6. Keep the visual direction from 017 task 5. Every input and checkbox has a label tied to it. Each page has one h1.

7. Tests with Vitest, next to the code:
   - toAlertInput for each category, including comma lists with spaces and empty entries, and fromAlertDto round trips.
   - the target form shows a "Webhook URL" input when Slack is chosen and an "Email address" input when Email is chosen, read from the shared map.
   - the alerts page switch calls PATCH with the new value.
   - the targets page shows the 409 message on delete.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- git status --short
Do not start dev servers. The orchestrator checks the pages in a browser.

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 350 words:
1. Files added or changed.
2. Whether native-select and checkbox were added, and any CLI error.
3. Test count per new spec file.
4. Command results, one line each.
5. Deviations from the design or this prompt, and why.
6. What you could not verify.
```
