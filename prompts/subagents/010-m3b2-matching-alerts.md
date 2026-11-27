# 010 Implement M3, part b2: matching and alerts

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer for part b2 of milestone M3 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit only apps/api.

Read first: AGENTS.md; in docs/design.md the sections "Matching rules", "Severity for simulated events", "Security" (object access) and the Alerts table under "HTTP API"; libs/shared/src/lib/alerts.ts, events.ts, enums.ts and params.ts; every file under apps/api/src, including the targets routes and their spec, which show the patterns to follow.

Environment: Postgres at 127.0.0.1:5432. No Docker access; do not run docker commands. Never print .env. Tests use TEST_DATABASE_URL through apps/api/vitest.config.mts.

Tasks:

1. apps/api/src/matching/match.ts: matchesFilters(event, alert) exactly as the design's "Matching rules" section says. The event and the alert are plain objects with category, severity or minSeverity, and data or filters. Keyword matching escapes the keyword for regex and wraps it in (?<![\p{L}\p{N}]) and (?![\p{L}\p{N}]) with the flags iu.

2. apps/api/src/matching/severity.ts: marketSeverity(changePct) and earthquakeSeverity(magnitude) with the thresholds in "Severity for simulated events".

3. Alerts routes under /api/alerts, all behind requireUser, as in the design's Alerts table:
   - GET /: the user's alerts as AlertDto with targetIds.
   - POST /: parse AlertInput. Every targetId must belong to the user, otherwise 400. Insert the alert and its alert_targets rows in one transaction. 201.
   - GET /:id, PUT /:id, PATCH /:id with PatchEnabled, DELETE /:id: parse IdParam. Another user's alert or an unknown id is 404. PUT replaces every field and the target set in one transaction and sets updated_at.

4. apps/api/vitest.config.mts: run spec files one at a time, with fileParallelism false. Route specs share rows such as the channels table in alerts_test, and the part b1 implementer reported that parallel files could see each other's changes.

5. Tests with Vitest, next to the code:
   - match: a table of cases per category. Include: keyword "oil" against "Oil prices" true and against "boil" false; "C++" against "New C++ standard" true; "S&P" against "S&P 500 falls" true; empty keywords match any news event; symbols compared in uppercase; direction up with a negative change false; abs(changePct) equal to minChangePct true; types and regions empty match any; an earthquake without a magnitude and minMagnitude set false; minMagnitude ignored for a flood; severity below minSeverity false; category mismatch false.
   - severity: each threshold boundary for both functions.
   - alerts routes with app.inject: create one alert per category; filters of another category give 400; a targetId that belongs to another user gives 400; GET of another user's alert gives 404; PUT without enabled gives 400; PATCH { enabled: false } then GET shows false; PUT replaces the target set; DELETE then GET gives 404. Each test removes its rows.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- for match.ts, remove the lookarounds and use \b instead; report which tests fail; restore
- for the alerts routes, drop the ownership check on targetIds; report which test fails; restore
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added or changed.
2. Test count per file.
3. Command results, one line each.
4. Deviations from the design or this prompt, and why.
5. What you could not verify.
```
