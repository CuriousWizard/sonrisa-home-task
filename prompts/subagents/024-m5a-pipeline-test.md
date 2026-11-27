# 024 Implement M5, part a: API pipeline integration test

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. The M3 specs already cover each route and the worker with fake channels. This test covers what they leave out: the whole path through real channels, Mailpit and the mock Slack receiver over HTTP.

```text
You are the implementer for part a of milestone M5 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/ or apps/web. Edit only apps/api, and only to add test files and test helpers. If the test finds a bug in the API, do not fix it; describe it in the report.

Read first: AGENTS.md; the "Tests" row "Integration" and the sections "Event flow", "Delivery states" and "Dev only" in docs/design.md; apps/api/src/app.ts, main.ts, config.ts, channels/registry.ts, delivery/worker.ts, dev/routes.ts and admin/routes.ts; apps/api/vitest.config.mts; and two existing specs for their setup patterns: apps/api/src/delivery/worker.spec.ts and apps/api/src/admin/routes.spec.ts.

Environment: Postgres at 127.0.0.1:5432. Mailpit SMTP at 127.0.0.1:1025 and its REST API at http://127.0.0.1:8025/api/v1, where GET /api/v1/search?query=to:<address> returns { messages: [...] } with a Subject per message. No Docker access. Never print .env. Spec files run one at a time against TEST_DATABASE_URL.

Task: add apps/api/src/pipeline.integration.spec.ts.

Setup:
- Find a free port first: listen on port 0 with node:net, read the port, close it.
- Build the config with loadConfig from the test environment, overriding: SLACK_WEBHOOK_ALLOWED_PREFIXES with http://127.0.0.1:<port>/api/dev/mock-slack/, DELIVERY_BACKOFF_BASE_MS 0, DELIVERY_MAX_ATTEMPTS 3, AUTH_RATE_LIMIT_MAX 1000.
- Build the app with the real channel registry from createChannelRegistry(config) and listen on 127.0.0.1:<port>. Create a worker with createWorker and call tick() by hand, so the test controls timing. Do not start the scheduler.
- Call the API with fetch over HTTP and carry the session cookie yourself. Create the admin user directly in the database with role admin.
- Use a random suffix in every email address, hook id, alert name and event title, so runs do not see each other's data.

Scenarios, one test each:
1. A user registers, adds an email target and a Slack target on the mock URL, and creates a market alert with empty symbols, direction any, minChangePct 5 and minSeverity 1. An injected market event with changePct 7 returns deliveriesCreated 2. After one tick both rows are sent. Mailpit search for the address finds one message whose subject starts with "[market]". The mock receiver has one message for the hook id whose text holds the alert name.
2. An injected market event with changePct 2 returns deliveriesCreated 0.
3. With the mock's fail mode on, a matching event leaves the Slack row failed after one tick and dead after three, with attempts 3 and last_error "Slack responded 500". The email row is sent. Then the admin retries the dead row through POST /api/admin/deliveries/:id/retry, fail mode goes off, and one tick makes it sent.
4. With the slack channel switched off through PATCH /api/admin/channels/slack, a matching event creates a skipped Slack row and a pending email row. Switch the channel back on in a finally block.

Cleanup: delete the users you created, which cascades to their targets, alerts and deliveries; delete the events you injected; turn fail mode off; close the app and the pool.

Verification you must run, and report each in one line:
- npx nx test api --skip-nx-cache, with the count of tests in the new file
- npx nx run-many -t build lint test --skip-nx-cache
- run the new spec file twice in a row with npx vitest run --config apps/api/vitest.config.mts apps/api/src/pipeline.integration.spec.ts, to show that the cleanup leaves nothing that breaks a second run
- break one rule: in apps/api/src/events/ingest.ts, give every new delivery status pending whatever its channel's switch says; report which scenario fails; restore it
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files added.
2. Command results, one line each.
3. Any API bug the test found.
4. Deviations from this prompt, and why.
5. What you could not verify.
```
