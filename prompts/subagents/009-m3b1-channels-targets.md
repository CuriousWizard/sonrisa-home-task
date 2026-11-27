# 009 Implement M3, part b1: channels and targets

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`. The prompt is shorter than 007 because the 007 run stopped without a report. Part b is split into b1 (this prompt) and b2 (matching and alerts).

```text
You are the implementer for part b1 of milestone M3 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Edit apps/api, and package.json only to add a dependency.

Read first: AGENTS.md; in docs/design.md the sections "Extension points", "Security", "Delivery states" and the Targets table under "HTTP API"; libs/shared/src/lib/channels.ts and params.ts; every file under apps/api/src.

Environment: Postgres at 127.0.0.1:5432, Mailpit SMTP at 127.0.0.1:1025 and HTTP at :8025. No Docker access; do not run docker commands. Never print .env. Tests use TEST_DATABASE_URL through apps/api/vitest.config.mts. nodemailer 10.6.1 is installed.

Tasks:

1. apps/api/src/channels/channel.ts: the NotificationChannel<C> and NotificationMessage interfaces from the design.

2. apps/api/src/channels/slack-url.ts: assertAllowedSlackUrl(raw, prefixes) returns the parsed URL or throws a typed error. Reject a URL with a username or password. Accept only when origin + pathname starts with one of the prefixes. The error message must not contain the URL.

3. apps/api/src/channels/slack.ts: a Slack channel built from the allowed prefixes. assertConfigAllowed runs the URL check. send runs the check again, then POSTs JSON { "text": "*<subject>*\n<text>" } to url.href with redirect 'error' and AbortSignal.timeout(5000). Any status outside 200 to 299 throws "Slack responded <status>". A timeout throws "Slack request timed out". Any other network error throws "Slack request failed". No error message contains the URL.

4. apps/api/src/channels/email.ts: an email channel on a Nodemailer SMTP transport to SMTP_HOST and SMTP_PORT, secure false, with connectionTimeout, greetingTimeout and socketTimeout of 10000 ms, from MAIL_FROM. send sends subject and text to config.address. Errors are rethrown with a short message such as "SMTP error: <code>".

5. apps/api/src/channels/registry.ts: createChannelRegistry(config) returns a record keyed by every ChannelId from @alerts/shared, so a channel added to the shared map without an implementation fails to compile.

6. apps/api/src/db/registry-sync.ts: syncRegistryRows(db, { channelIds, sources }) inserts a channels row per id and a sources row per { id, category } with enabled true and on conflict do nothing. main.ts calls it at startup with the channel ids and an empty source list; part c adds the sources.

7. apps/api/src/delivery/message.ts: buildMessage(event, alertName) returns { subject, text }. The subject is "[<category>] <title>". The text has the summary, the severity, the category-specific data in plain words, and the alert name. Also buildTestMessage(targetName).

8. buildApp: add the channel registry to deps so tests can pass fakes.

9. Targets routes under /api/targets, all behind requireUser, as in the design's Targets table:
   - GET /: the current user's targets as TargetDto.
   - POST /: parse TargetInput, run the channel's assertConfigAllowed (a failure is 400), insert, 201.
   - DELETE /:id: parse IdParam. Another user's target or an unknown id is 404. A target that an alert still uses is 409. Otherwise 204.
   - POST /:id/test: own target only, else 404. If the channels row for its channel is disabled, 409. Otherwise send buildTestMessage through the registry and return { ok: true } or { ok: false, error }.

10. Tests with Vitest, next to the code:
   - slack-url: an allowed URL passes; these fail: https://hooks.slack.com.evil.com/services/x, https://evil.com/?https://hooks.slack.com/services/, https://user@hooks.slack.com/services/x, https://hooks.slack.com/services/../api, http://hooks.slack.com/services/x when only the https prefix is allowed.
   - slack channel against a local node:http server on port 0, with that server's prefix allowed: 200 succeeds and the body has the formatted text; 500 throws "Slack responded 500"; a 302 throws; a slow response hits the timeout. No thrown message contains the URL. Lower the timeout through an option if you need to keep the test fast.
   - message: subject format and that the text holds the alert name and the category data.
   - targets routes with app.inject and a fake channel registry: create an email target; a Slack target with a disallowed URL gives 400; deleting another user's target gives 404; deleting a target that an alert uses gives 409, with the alert and alert_targets rows inserted directly; the test route gives 409 when the channel row is disabled and { ok: true } with the fake channel otherwise. Each test removes its rows.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- for one test per new spec file, break the rule, see the test fail, restore the rule
- start the API with npx nx serve api in the background; log in as the seeded user with a cookie jar; create an email target with address demo@example.local; call its test route; confirm through http://127.0.0.1:8025/api/v1/messages that Mailpit received the message; stop the server
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 350 words:
1. Files added or changed.
2. Test count per file.
3. Command results, one line each.
4. Deviations from the design or this prompt, and why.
5. What you could not verify.
```
