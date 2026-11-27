# 019 Finish M4 part b: failing spec and missing components

Sent to: default implementer subagent. Reason: the 018 run wrote the targets and alerts pages and their specs, then returned an empty message. The orchestrator found 5 failing tests in alert-form-page.spec.ts ("missing #alert-name") and no native-select or checkbox component. A dry run of the spartan CLI for native-select works, so the CLI is not the blocker. Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer finishing part b of milestone M4 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/, apps/api or libs/shared.

Read first: prompts/subagents/018-m4b-targets-alerts.md (the task you are finishing); task 5 of prompts/subagents/017-m4a-shell-auth.md; every file under apps/web/src/app/alerts, apps/web/src/app/targets, apps/web/src/app/core and apps/web/src/app/layout.

State: the pages, API services and specs from prompt 018 exist. npx nx test web fails: all 5 tests in apps/web/src/app/alerts/alert-form-page.spec.ts throw "missing #alert-name" or a similar missing element. The other web specs pass.

Tasks:
1. Find why alert-form-page.spec.ts finds no form elements. Decide whether the component or the test is wrong, fix that side, and say which it was and why. Do not weaken an assertion to make it pass.
2. Add the spartan native-select and checkbox components: NX_DAEMON=false npx nx g @spartan-ng/cli:ui --name=native-select --directory=libs/ui, then the same with --name=checkbox. A dry run of the first one succeeded. Then use them for every select and checkbox in the alert form and the target form, and keep the labels tied to each control.
3. Keep the specs from 018 passing after the switch.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- git status --short
Do not start dev servers.

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 250 words:
1. The cause of the failing spec and the fix.
2. Files added or changed.
3. Command results, one line each.
4. What you could not verify.
```
