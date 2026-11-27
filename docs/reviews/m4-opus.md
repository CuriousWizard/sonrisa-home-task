# M4 review by reviewer-opus (Claude Opus 5.5)

Prompt: `prompts/subagents/021-review-m4.md`. The text below the line is the reviewer's reply, word for word.

---

### Findings

| ID  | Severity | Location                                                   | Finding                                                                                                                                                                                                                               | Evidence                                                                                                       | Suggested fix                                                                                                                       |
| --- | -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| F1  | minor    | docs/decision-log.md                                       | Neither known deviation is recorded anywhere in the docs. design.md:352 still says the UI components come from spartan-ng.                                                                                                            | A grep for `env.serve\|ng-icons\|native-select\|checkbox` in docs/ finds nothing.                              | Add a decision for the plain select and checkbox, citing the registry 404. Add a note on `apps/web/.env.serve` under Configuration. |
| F2  | minor    | apps/web/src/app/targets/targets-page.html:161             | The Slack allowlist rejection ("Webhook URL is not on the allowed list") shows in a box under the submit button, not under the Webhook URL field. The register 409 for an email already in use does the same (register-page.html:52). | targets/routes.ts:62 returns 400 with that message, and the template renders `serverError` after the form.     | Show a create 400 under the config fields block, and the register 409 under the email field.                                        |
| F3  | minor    | apps/web/src/app/core/auth.interceptor.ts:10               | No spec covers 401 handling. Nothing checks the redirect to /login, the store clear, or that `/api/auth/me` is exempt.                                                                                                                | A grep for `authInterceptor\|withInterceptors` in the specs finds nothing.                                     | Add a spec: a 401 from `/api/alerts` clears the store and goes to /login, and a 401 from `/api/auth/me` does neither.               |
| F4  | minor    | apps/web/src/app/alerts/alerts-page.spec.ts:58             | The final `aria-checked=false` assertion passes even with the response handling removed, because `HlmSwitch.handleChange` sets its own state. The alerts page has no test for a failed PATCH putting the switch back.                 | hlm-switch.ts:113 calls `this.checked.set(value)`.                                                             | Flush a 500 and assert that `aria-checked` returns to `true` and the error text shows.                                              |
| F5  | minor    | events-page.ts:50, deliveries-page.ts:72, users-page.ts:38 | Commit 086f260 claims stale responses are dropped, but no test covers it. Removing `id === this.requestId` keeps all 36 tests green.                                                                                                  | No spec mentions requestId, and no spec flushes responses out of order.                                        | Start two loads, flush the newer one first, and assert the newer list stays.                                                        |
| F6  | minor    | targets-page.html:42, alerts-page.html:58                  | Clicking Delete removes the focused button, because the `@if`/`@else` swaps in "Confirm delete". Keyboard focus falls to `<body>`.                                                                                                    | Template structure.                                                                                            | Keep one button and change its label and variant, or move focus to Confirm.                                                         |
| F7  | nit      | users-page.html:46 and the other row actions               | Every row's button has the same accessible name ("Show alerts", "Send test", "Delete", "Retry"). M5 role locators will need row scoping.                                                                                              | Template.                                                                                                      | Add an `aria-label` with the row name.                                                                                              |
| F8  | nit      | targets-page.ts:28                                         | The comment is wrong. The default `ChannelField` has `key: string` and accepts both channels' field arrays, so `ConfigField` duplicates it.                                                                                           | channels.ts:15 defaults to `Record<string, unknown>`.                                                          | Use `ChannelField` and drop the comment.                                                                                            |
| F9  | nit      | libs/shared/src/lib/channels.ts:28                         | No test pins "a typo fails to compile". The claim holds when checked by hand.                                                                                                                                                         | An in-memory tsc run of `key: "adress"` gave `Type '"adress"' is not assignable to type '"address"'`.          | Add a `@ts-expect-error` case.                                                                                                      |
| F10 | minor    | process                                                    | The range has 3 commits, not 4. Prompts 017 to 021 are untracked, and prompts/prompt-log.md is modified but not committed.                                                                                                            | `git rev-list --count 4add287..HEAD` gives 3. `git status --porcelain` shows the untracked and modified files. | Commit the prompts and the log as the docs commit.                                                                                  |
| F11 | nit      | commit 3f61e05 body                                        | The body mostly lists what was added and says why for only two items. "the pages parts b and c build" is process jargon. The F6 type fix in libs/shared is bundled with the web shell.                                                | `git log`                                                                                                      | Reword it if it is not pushed yet.                                                                                                  |

### Verified

- **Routes and API calls:** every route in the design's Web app table exists and calls the API route the design names, typed with `@alerts/shared`. Lists send `limit=200`, which is `LIMITS.listMax`.
- **Storage and HTML injection:** no `localStorage`, `sessionStorage`, `innerHTML`, `DomSanitizer` or `bypassSecurityTrust` in apps/web or libs/ui.
- **Slack secret:**
  - Slack rows show only the webhook host, and a spec asserts that `secret` is absent from the table.
  - slack-url.ts error messages contain no URL.
- **Admin gating:**
  - Admin links show only when `auth.isAdmin()` is true.
  - `adminGuard` is on the `/admin` parent route.
  - The server check is unchanged.
- **401 handling:** the interceptor exempts `/me`, clears the store and navigates to /login. The store caches a 401 but not other errors.
- **Alert form conversion:**
  - `toAlertInput` and `fromAlertDto` round trip news, market, and disaster both with and without `minMagnitude`.
  - `alertErrors` strips the `filters` prefix.
  - The edit spec asserts the full PUT body.
- **Target form:** built from the `channels` map, with no per-channel branch.
- **Labels and headings:**
  - Every input, select and checkbox has a label tied to it.
  - The `for="alert-enabled"` label reaches the switch's inner button, because BrnSwitch moves the id there and gives the container a postfix (spartan-ng-brain-switch.mjs:195).
  - Each page has one h1 from `PageHeader`, and the shell has none.
  - The nav has an `aria-label`.
- **Keyboard:** the switch is a native `button role="switch"`.
- **Status by text:** status badges carry text labels, and each status has a distinct colour.
- **Visual direction:**
  - The accent is oklch hue 242.7, which is blue.
  - No gradient, shadow, blur, animation, emoji, icon or exclamation mark.
  - Buttons are `rounded-lg`, not pills.
- **Native validation:** `ReactiveFormsModule` adds `novalidate`, so the browser's own validation does not run before the zod messages.
- **Select and checkbox deviation:**
  - `npm view @ng-icons/core` and `npm view @ng-icons/lucide` return 404 on the configured registry.
  - The spartan CLI templates for native-select and checkbox import `@ng-icons`.
- **Port deviation:**
  - @angular/build dev-server options.js:77 prefers `process.env.PORT` over the port option.
  - Nx unloads the root `.env` and loads the project's `.env.serve` first (task-env-paths.js).
  - The `serve-static` file server reads only `options.port`.
  - `.env.serve` holds only `PORT`.
- **Tests and lint:** `nx run-many -t test lint -p web --skip-nx-cache` passes, with 11 test files and 36 tests.
- **Tests that would catch a broken rule:** the specs for deliveries retry and 409, the settings switch revert, metrics 12.5%, the users request param, the target delete 409, the category reset and the guards would each fail if their rule were removed.
- **Commit headers:**
  - 915aece and 086f260 touch only apps/web, so the `web` scope is right.
  - 3f61e05 spans libs and root files, so the empty scope is right.
  - All three summaries are lowercase and imperative with no final period, and every body is longer than 20 characters.
- **Dependencies:** `@angular/cdk`, `cn`, `@spartan-ng/brain` and `class-variance-authority` are in package.json.

### Not verified

- Rendering, colours and focus behaviour in a browser, because the constraints rule out starting a dev server.
- API specs and builds of other projects, also excluded by the constraints.
- Whether the M4 commits are already pushed. This decides whether F11 can still be fixed.
