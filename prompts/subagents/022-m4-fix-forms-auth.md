# 022 Apply M4 review findings, part 1: forms and auth

Sent to: default implementer subagent. Findings from `docs/reviews/m4-opus.md` (F2, F3, F8, F9) and `docs/reviews/m4-gpt.md` (M4-01, M4-02, M4-04, M4-05, M4-06 in part). Checked against `docs/prompting-opus-5-5.md`.

```text
You are the implementer for review fixes to the web forms and auth in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/, apps/api or libs/ui. Edit apps/web, and libs/shared only for task 7.

Read first: docs/reviews/m4-opus.md and docs/reviews/m4-gpt.md; every file under apps/web/src/app/alerts, apps/web/src/app/targets, apps/web/src/app/auth and apps/web/src/app/core; libs/shared/src/lib/channels.ts and alerts.ts.

Changes:

1. M4-01. Editing an alert must keep target ids that are not in the loaded target list. The form sends them back unchanged in the PUT unless the user removes them. Show a line such as "Also sends to 2 targets not listed here." Add a test: an alert whose targetIds include an id missing from the target list keeps that id in the PUT body.

2. M4-02. Sign-out clears the user only when POST /api/auth/logout succeeds or returns 401. Any other failure keeps the user, shows "Sign-out failed. Try again." in the top bar, and stays on the page. Add tests for success, 401 and 500.

3. M4-04. News keywords become a textarea with one keyword per line, so a keyword such as "Washington, DC" survives a round trip. Symbols stay comma-separated. Update toAlertInput, fromAlertDto and the label text. Add a round-trip test with "Washington, DC".

4. F2 and M4-05. Show field-specific server errors next to their field:
   - the Slack allowlist 400 on target create under the config fields
   - the 409 for an email already in use under the email field on register
   - the alert 400 for a target that is not the user's under the targets group
   Keep other server errors at form level. Add one test for the Slack case.

5. F3. Add a spec for the 401 interceptor: a 401 from /api/alerts clears the store and navigates to /login; a 401 from /api/auth/me does neither.

6. M4-06, in part. Add a test that reads appRoutes and checks that the signed-in routes use authGuard and the /admin routes use adminGuard. Leave the channel descriptor test as it is; varying the shared map in a test would need it injected, which is out of scope.

7. F9. Add a type-level test in libs/shared with @ts-expect-error on a channel field whose key is not in its config, so the compile-time rule cannot regress silently.

8. F8. In targets-page.ts, use ChannelField from @alerts/shared instead of the local ConfigField type, and remove the wrong comment.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- remove the keep-unlisted-ids logic from task 1; report which test fails; restore
- git status --short
Do not start dev servers.

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 300 words:
1. Files changed or added.
2. Command results, one line each.
3. Deviations from this prompt, and why.
4. What you could not verify.
```
