# 023 Apply M4 review findings, part 2: tables, switches and layout

Sent to: default implementer subagent, after prompt 022 finished. Findings from `docs/reviews/m4-opus.md` (F4, F5, F6, F7) and `docs/reviews/m4-gpt.md` (M4-03, M4-07), plus one from the orchestrator's browser check: at a 1024 pixel wide window the deliveries table scrolls sideways and the Retry buttons are off screen. Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer for review fixes to the web tables, switches and layout in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/, apps/api, libs/shared or libs/ui. Edit only apps/web.

Read first: docs/reviews/m4-opus.md and docs/reviews/m4-gpt.md; every file under apps/web/src/app/admin, apps/web/src/app/alerts, apps/web/src/app/targets and apps/web/src/app/layout.

Changes:

1. M4-03 and F4. Every switch that calls PATCH, on the alerts page and the settings page, is disabled while its request runs, so a second toggle cannot race the first. A failed PATCH puts the switch back and shows the error. On the alerts page, add a test where a 500 puts the switch back to on and shows the error, and a test that the switch is disabled while the request is pending.

2. F5. Add tests for the stale-response rule on the events, deliveries and users pages: start two loads, answer the newer one first, then the older one, and assert that the newer list stays.

3. F6. The Delete action on the targets and alerts pages keeps one button. The first click changes its label to "Confirm delete" and its style to destructive. Focus stays on the button. Escape or focus leaving the button cancels.

4. F7. Row buttons get an aria-label that names the row, such as "Send test to Team Slack", "Delete alert Big quakes in Asia", "Retry delivery for Quake near Manila to Team Slack" and "Show alerts of user@example.local". The visible text stays short.

5. M4-07. The top bar wraps onto two lines on narrow windows instead of overflowing. Remove the fixed height.

6. Deliveries table at 1024 pixels: move the Actions column next to the Status column, and let the Last error column wrap at a fixed width, so Retry is visible without scrolling at a 1024 pixel wide window.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- remove the disabled-while-pending rule from the alerts page; report which test fails; restore
- remove the request id check from the events page; report which test fails; restore
- git status --short
Do not start dev servers.

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files changed or added.
2. Command results, one line each.
3. Deviations from this prompt, and why.
4. What you could not verify.
```
