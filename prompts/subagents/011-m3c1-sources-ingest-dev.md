# 011 Implement M3, part c1: sources, ingest, dev routes

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. Part c is split into c1 (this prompt) and c2 (delivery worker).

```text
You are the implementer for part c1 of milestone M3 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit only apps/api.

Read first: AGENTS.md; requirements R7 to R11, R17 and R18 in docs/requirements.md; in docs/design.md the sections "Event flow", "Data model", "Delivery states" (only the ingest rules), "Severity for simulated events", "Sources" under "Extension points", and the "Dev only" table; libs/shared/src/lib/events.ts, dev.ts and enums.ts; every file under apps/api/src. Follow the patterns in the existing routes and specs.

Environment: Postgres at 127.0.0.1:5432. No Docker access; do not run docker commands. Never print .env. Tests use TEST_DATABASE_URL and run one file at a time.

Tasks:

1. Sources, in apps/api/src/sources:
   - source.ts: the EventSource interface from the design. poll returns events that carry sourceId and externalId plus the EventInput fields.
   - simulated/news.ts, market.ts, disaster.ts: one event per poll with a random externalId. Take random as an injectable function so tests are deterministic. Market and earthquake severity come from matching/severity.ts. News titles of severity 4 and 5 start with "Breaking:". nextDelayMs returns a new random value between SOURCE_MIN_INTERVAL_MS and SOURCE_MAX_INTERVAL_MS on every call.
   - registry.ts: the three simulators with ids news-sim, market-sim and disaster-sim.
   - scheduler.ts: startScheduler returns a stop function. One setTimeout chain per source. Before each poll it reads sources.enabled and skips the poll if the source is disabled. It calls ingestEvent for each polled event. An error in one poll is logged and does not stop the chain.

2. apps/api/src/events/ingest.ts:
   - ingestEvent(db, event) runs one transaction: insert the event with on conflict (source_id, external_id) do nothing, then call matchEvent. It returns the stored event and the number of deliveries created, or null if the event already existed.
   - matchEvent(tx, event) selects enabled alerts in the event's category with min_severity <= severity, with their targets; filters them with matchesFilters; reads which channels are enabled; inserts one delivery per alert and target with on conflict do nothing. A row for a disabled channel gets status skipped, attempts 0 and last_error 'channel disabled'. Any other row gets status pending. It returns the number of rows inserted.

3. main.ts: pass the three sources to syncRegistryRows and start the scheduler after the server listens. Stop it on SIGINT and SIGTERM.

4. Dev routes under /api/dev, registered in buildApp only when NODE_ENV is not production:
   - POST /events: parse EventInput, ingest with sourceId 'dev' and a random externalId, 201 with the event and the delivery count.
   - POST /mock-slack/:hookId: parse HookIdParam and MockSlackMessage, store { hookId, text, receivedAt } in memory, return 500 while fail mode is on, otherwise 200. Keep at most the newest 500 messages.
   - GET /mock-slack/messages, DELETE /mock-slack/messages (204), PUT /mock-slack/mode with { fail: boolean }.
   - These routes need no login, because only a developer's machine runs them.

5. Tests with Vitest, next to the code:
   - simulators: with a fixed random function, each event passes the shared EventInput schema; market and earthquake severity follow severity.ts; nextDelayMs stays within the bounds.
   - ingest against alerts_test: a matching alert with an email and a Slack target creates two pending rows; a disabled channel creates a skipped row with attempts 0; an alert below the event severity or in another category creates none; a disabled alert creates none; calling matchEvent again for the same event creates no new rows; ingesting the same sourceId and externalId twice returns null the second time.
   - scheduler: with fake timers and a stub ingest, a disabled source is not polled and an enabled one is; a throwing poll does not stop the chain.
   - dev routes: POST /api/dev/events returns 201 and the delivery count; the routes return 404 when buildApp gets NODE_ENV production; mock Slack stores a message, returns 500 in fail mode, and caps the store at 500.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- in ingest.ts, drop the on conflict clause on deliveries; report which test fails; restore
- in the dev routes, register them in production too; report which test fails; restore
- start the API with npx nx serve api with SOURCE_MIN_INTERVAL_MS=2000 and SOURCE_MAX_INTERVAL_MS=3000 set in the shell, wait 15 seconds, count rows in events by source_id with a short tsx or node script against DATABASE_URL, stop the server
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added or changed.
2. Test count per file.
3. Command results, one line each.
4. Deviations from the design or this prompt, and why.
5. What you could not verify.
```
