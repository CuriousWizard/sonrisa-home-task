# 012 Implement M3, part c2: delivery worker

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. The claim and result rules come from the M1 reviews, so the prompt quotes them as states the row passes through.

```text
You are the implementer for part c2 of milestone M3 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit only apps/api.

Read first: AGENTS.md; requirement R10 and R11 in docs/requirements.md; in docs/design.md the sections "Event flow" and "Delivery states" in full; decisions D-018 and D-024 in docs/decision-log.md; every file under apps/api/src, in particular db/schema.ts, events/ingest.ts, channels/registry.ts and delivery/message.ts.

Environment: Postgres at 127.0.0.1:5432, Mailpit SMTP at 127.0.0.1:1025 and HTTP at :8025. No Docker access; do not run docker commands. Never print .env. Tests use TEST_DATABASE_URL and run one file at a time.

Tasks:

1. apps/api/src/delivery/backoff.ts: computeBackoff(attempt, baseMs, random) returns baseMs * 2^(attempt - 1) plus random() * 10% of that value.

2. apps/api/src/delivery/worker.ts: createWorker({ db, channels, config, logger, random }) with tick(), start() and stop().
   tick() does these steps in order:
   a. One UPDATE sets status dead and last_error 'lease expired' on every row with status sending, next_attempt_at <= now() and attempts >= DELIVERY_MAX_ATTEMPTS.
   b. One statement claims rows: UPDATE deliveries ... WHERE id IN (SELECT id ... FOR UPDATE SKIP LOCKED LIMIT 10) RETURNING. A row qualifies when its channel row is enabled, attempts < DELIVERY_MAX_ATTEMPTS, next_attempt_at <= now(), and status is pending, failed or sending. The claim sets status sending, attempts = attempts + 1 and next_attempt_at = now() + DELIVERY_LEASE_MS. The claim commits before any send starts.
   c. Load the target config, the event and the alert name for the claimed rows.
   d. Send all claimed rows at the same time with Promise.allSettled, through the registry, using buildMessage.
   e. Write each result with WHERE id = :id AND status = 'sending' AND attempts = :claimedAttempts. Success sets sent, sent_at now and last_error null. A failure with attempts < max sets failed, last_error to the error message, and next_attempt_at = now + computeBackoff(attempts). A failure with attempts >= max sets dead. If the fenced update matches no row, drop the result and log it at debug level.
   start() schedules the next tick with setTimeout WORKER_POLL_MS after the previous tick finishes, so ticks never overlap. stop() returns a promise that resolves after the running tick ends. A tick that throws is logged and the loop goes on.

3. main.ts: start the worker after the server listens and stop it on SIGINT and SIGTERM before the pool closes.

4. config.ts: reject SOURCE_MIN_INTERVAL_MS greater than SOURCE_MAX_INTERVAL_MS. The part c1 implementer found that swapped values give a near-zero delay. Add a test.

5. Tests with Vitest against alerts_test, with a fake channel registry whose send you control and DELIVERY_BACKOFF_BASE_MS set low:
   - a pending row is sent and becomes sent with sent_at set and attempts 1
   - a failing send makes the row failed with attempts 1 and next_attempt_at about now + base
   - with max attempts 3 and base 0, three ticks with a failing send end in dead, and the fake channel was called exactly three times
   - a sending row with an expired lease and attempts at max becomes dead on the next tick and is not sent
   - a sending row with an expired lease and attempts below max is claimed again and sent
   - a stale result is dropped: claim a row, raise its attempts in the database as if a newer claim took it, then let the first send finish; the row keeps the newer state
   - a row whose channel is disabled stays pending and is not sent; after the channel is enabled, the next tick sends it
   - two ticks run at the same time on one pending row send it once
   - computeBackoff: attempt 1 to 4 with random 0 gives 1, 2, 4 and 8 times base; random 1 adds 10%

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- remove attempts < max from the claim; report which test fails; restore
- remove the fence from the result update; report which test fails; restore
- end to end: start the API with npx nx serve api and DELIVERY_BACKOFF_BASE_MS=1000 in the shell. Log in as the seeded user. Create a Slack target with the URL http://localhost:3000/api/dev/mock-slack/demo and an email target with demo@example.local. Create a market alert on both targets with empty symbols, direction any, minChangePct 5 and minSeverity 1. Inject a market event through POST /api/dev/events with changePct 7. Within 10 seconds, show the message in GET /api/dev/mock-slack/messages and in Mailpit's /api/v1/messages. Then PUT /api/dev/mock-slack/mode { fail: true }, inject a second event, wait 20 seconds, and report the Slack delivery's status and attempts with a short script against DATABASE_URL. Set fail mode back to false, delete the alert and targets, and stop the server.
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 350 words:
1. Files added or changed.
2. Test count per file.
3. Command results, one line each, with the end-to-end statuses.
4. Deviations from the design or this prompt, and why.
5. What you could not verify.
```
