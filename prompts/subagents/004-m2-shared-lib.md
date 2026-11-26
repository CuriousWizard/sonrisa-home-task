# 004 Finish M2, part 2: shared zod library

Sent to: default implementer subagent, after prompt 003 finished.

```text
You are the implementer for the shared library in milestone M2 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Edit only libs/shared, plus package.json and package-lock.json to add zod. Do not edit docs/, prompts/, AGENTS.md or .github/.

Read AGENTS.md, then these sections of docs/design.md: "Shared library", "Data model", "Delivery states", "Matching rules" and "HTTP API".

Current state: libs/shared is an Nx TypeScript library with Vitest, importable as @alerts/shared. It holds only generated placeholder code. Delete the placeholder.

Tasks:
1. Install zod 4. Check the latest version with npm view zod version first.
2. Write the schemas from "Shared library", split over a few files under libs/shared/src/lib and exported from libs/shared/src/index.ts:
   - Category, Region, Severity (integer 1 to 5), DisasterType, Role, DeliveryStatus (pending, sending, sent, failed, dead, skipped)
   - per-category event data schemas and alert filter schemas, with no category field inside them
   - EventInput: discriminated union on top-level category; fields category, title, summary (optional, default ''), severity, data, occurredAt (optional ISO datetime)
   - AlertInput: discriminated union on top-level category; shared fields name, minSeverity, targetIds (at least one uuid), enabled (default true), plus filters for that category
   - the channels map: for each channel id, configSchema, label and fields ({ key, label, inputType }). email config { address } with a valid email. slack config { webhookUrl } with a valid URL. The Slack allowlist check is the API's job, not this library's.
   - ChannelId derived from the keys of the channels map
   - TargetInput: discriminated union on channel with name and config. Build it from the map if the inferred type stays exact; otherwise list the branches in the same file as the map
   - RegisterInput and LoginInput: email trimmed and lowercased, password at least 10 characters for RegisterInput
   - MockSlackMessage { text } with at most 10000 characters, PatchEnabled { enabled }, ListQuery with limit coerced from a query string, default 50, max 200
   - response DTO types for user, target, alert, event, delivery, source, channel and metrics, matching the HTTP API section. Plain TypeScript types are fine for responses.
   - Put bounds on every string and array that comes from a user, such as name and keyword lengths and list sizes. Choose sensible limits and list them in your report.
3. Unit tests with Vitest. Each test must fail if the rule it covers is removed:
   - AlertInput rejects market filters under category news, and accepts a valid alert per category
   - EventInput rejects disaster data under category market
   - TargetInput rejects a slack config under channel email
   - Severity rejects 0, 6 and 2.5
   - RegisterInput rejects a 9-character password and lowercases the email
   - ListQuery turns '500' into an error and a missing limit into 50
4. Run npx nx run-many -t build lint test and make everything pass. Then run npx tsc --noEmit -p apps/api/tsconfig.app.json and the same for apps/web/tsconfig.app.json to check that both apps still compile.

Report back in under 400 words:
1. Files added.
2. zod version and the npm view output.
3. The limits you chose for strings and arrays.
4. Whether TargetInput is built from the map or listed, and why.
5. Test count and the command output summary.
6. Deviations from the design and anything you could not verify.
```
