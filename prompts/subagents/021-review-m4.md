# 021 Review M4

Sent to: `reviewer-opus` and `reviewer-gpt`, in parallel, with the same text.

```text
Review milestone M4 in /home/davidt/project/sonrisa-home-task. M4 is the Angular web app. It is committed as four commits: git log --oneline 4add287..HEAD, and git diff 4add287..HEAD -- apps/web libs/shared libs/ui tsconfig.base.json. Ignore package-lock.json, node_modules, dist, tmp, .nx and .angular.

Context:
- The contract is the "Web app" section of docs/design.md and requirements R1 to R6 and R12 to R16 in docs/requirements.md. The implementer prompts are prompts/subagents/017 to 020. Task 5 of 017 lists the visual direction and the patterns to avoid.
- The orchestrator already verified: nx run-many -t build lint test passes for 14 projects; in a browser through the dev proxy, sign-in, target create, a rejected Slack URL on the allowlist, test sends to email and Slack, alert create, edit and the enable switch, the deliveries page with failed, skipped and sent rows, retry of a skipped row, and the users, events, settings and metrics pages all work.
- Known deviations: selects and checkboxes are plain elements styled with the theme, because the spartan native-select and checkbox import @ng-icons, which the configured npm registry does not serve; apps/web/.env.serve sets PORT=4200 because Nx loads the root .env, where PORT is the API port, and the Angular dev server prefers PORT over its port option.
- Out of scope for M4: Playwright tests (M5) and the README (M6).

Constraints:
- Do not start the API or the web dev server. Do not run API specs; they use a shared test database. You may run npx nx test web and npx nx lint web.
- No Docker access. Never print .env.

Check in particular:
1. Every route and control in the design's Web app table exists and calls the API route the design names, with the shared types.
2. Security in the browser: no token or secret in localStorage or sessionStorage, no innerHTML or bypassSecurityTrust with data from the API, the Slack webhook path never shown, admin links and pages gated on the client while the server stays the real check, and 401 handling.
3. Forms: toAlertInput and fromAlertDto against the shared AlertInput for every category; the target form built from the channels map with no per-channel code; validation messages and server errors shown next to the right field.
4. Accessibility: labels tied to every control, one h1 per page, buttons with text, keyboard use of the switches, status shown by text and not only colour.
5. The visual direction and the avoid list in 017 task 5.
6. Tests: would each test fail if its rule were removed? Name tests that pass for the wrong reason.
7. The two known deviations: are they sound, and do the docs need an update?
8. The four commit messages against the rules in AGENTS.md.

Do not edit files. Use the output format from your agent instructions. Keep the review under 800 words.
```
