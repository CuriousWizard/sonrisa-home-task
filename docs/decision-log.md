# Decision log

Each entry records what was decided, which options were considered, who decided, and why. "User" means the user acting as product owner. "Orchestrator" means the main agent, with the user's approval of the plan.

## D-001 Event data is simulated

- Options: free public APIs with a simulator for demos, simulator only, public APIs only.
- Decided by: user.
- Reason: demos give the same result every time, no API keys are needed, and the time budget is 2.5 hours.
- Consequence: sources implement one interface, so a real feed such as USGS can replace a simulator without changes elsewhere.

## D-002 Alerts use category plus typed filters

- Options: category subscription only, category with typed filters, generic field and operator builder.
- Decided by: user.
- Reason: typed filters let a user express "earthquakes above magnitude 6 in Asia" without the cost of a query builder.

## D-003 Email and password sign-in with JWT and a seeded admin

- Options: email and password with JWT, fake user switcher, OAuth.
- Decided by: user.

## D-004 Docker Compose runs PostgreSQL 18 and Mailpit

- Options: SQLite, PostgreSQL.
- Decided by: orchestrator, after the user agreed to install Docker and asked for the best option.
- Reason: Postgres gives `FOR UPDATE SKIP LOCKED` for the delivery queue and `jsonb` for alert filters. Mailpit catches all SMTP mail and shows it in a web inbox, so no real mail leaves the machine.

## D-005 The deliveries table is the job queue

- Options: pg-boss, Redis with BullMQ, a `deliveries` table polled by a worker.
- Decided by: orchestrator.
- Reason: the admin delivery log and the retry button read and update the same rows the worker uses. pg-boss stores jobs in its own schema, so the app would have to copy job state into a second table. Redis adds a service the app does not otherwise need.
- Consequence: dedup is a unique index on (alert, event, target), and retry timing is a `next_attempt_at` column.

## D-006 Slack uses incoming webhooks and a mock receiver

- Options: incoming webhook per target, Slack app with a bot token, mock only.
- Decided by: user chose incoming webhooks. The user has no Slack workspace, so the orchestrator added a mock receiver.
- Reason: a webhook URL is the smallest real Slack integration. The mock receiver can be set to fail, which shows retries in the demo.
- Consequence: the API sends HTTP requests to URLs that users type in, which is a server-side request forgery risk. The API accepts only URLs that start with an allowlisted prefix (requirement N4).

## D-007 Fastify for the API

- Options: NestJS, Fastify, Express.
- Decided by: user.

## D-008 Nx monorepo

- Options: npm workspaces, Nx, two separate folders.
- Decided by: user.
- Check: `npm view @nx/angular peerDependencies` shows Nx 24.0.7 accepts Angular versions from 20 up to, but not including, 23. Angular 22.3.0 fits.

## D-009 spartan-ng for UI components

- Options: Angular Material, PrimeNG, Tailwind only, plain CSS. The user asked for shadcn-ui with Angular Material as the fallback.
- Decided by: user.
- Check: shadcn-ui is a React library. Its Angular port is spartan-ng. `npm view @spartan-ng/brain peerDependencies` shows version 1.10.1 accepts Angular from 21 up to, but not including, 23, and needs Tailwind 4.

## D-010 Drizzle ORM

- Options: Prisma, Drizzle, raw `pg` queries.
- Decided by: orchestrator.
- Reason: Drizzle defines the schema in TypeScript and has no code generation step or separate engine binary. Its query builder stays close to SQL, which makes the `SKIP LOCKED` claim query simple to write and to review.

## D-011 Angular commit message convention

- Decided by: user.
- Note: the Angular type list has no `chore` type. The earlier commit `chore: add gitignore and unslop skill` does not follow the convention. It is already pushed, so it stays as it is. Rewriting pushed history would need a force push.

## D-012 One orchestrator and two reviewers on different models

- Decided by: user.
- Setup: `reviewer-opus` runs on Claude Opus 5.5 and `reviewer-gpt` runs on GPT-6.2 Sol. Both agent files have the same body, so differences in the reviews come from the model and not from the instructions.
- Reason: the two models fail in different ways. Findings that only one reviewer reports get a second look from the orchestrator before they are accepted.
- Update after M1: GPT-6.2 Sol had no reasoning effort set and ran on medium for the M1 review. The user set it to extra high in VS Code. See V-005.

## D-013 Simulated events on a timer, plus an injection route

- Decided by: user.
- Setup: each source emits an event every 20 to 60 seconds. A route that exists only outside production injects a given event for tests and demos.

## D-014 Cut order

- Decided by: user accepted the orchestrator's proposal.
- Order: metrics page, then the Playwright test, then the admin switches for sources and channels.

## D-015 Passwords hashed with scrypt from `node:crypto`

- Options: argon2, bcrypt, bcryptjs, scrypt from `node:crypto`.
- Decided by: orchestrator.
- Reason: argon2 and bcrypt need native builds, which can break on a new Node major. bcryptjs is slow pure JavaScript. scrypt is built into Node and is memory-hard.

## D-016 JWT in an HttpOnly cookie, same origin through the dev proxy

- Options: bearer token in `localStorage`, HttpOnly cookie.
- Decided by: orchestrator.
- Reason: a script injected through XSS cannot read an HttpOnly cookie. The Angular dev proxy serves the API on the same origin, so `SameSite=Strict` works and CORS is not needed.

## D-017 Filter matching in TypeScript

- Options: translate filters to SQL, load candidate alerts and match in TypeScript.
- Decided by: orchestrator.
- Reason: one pure function holds every rule and gets table-driven unit tests. SQL narrows by category, enabled flag and minimum severity first. The limit on alert count is listed in `docs/design.md`.

## D-018 At-least-once delivery with a 60 second lease

- Options: at most once, at least once with a lease.
- Decided by: orchestrator.
- Reason: a lost alert is worse than a repeated one. The lease lets another worker pick up a row after a crash.

## D-019 Slack URL allowlist by prefix

- Options: host allowlist, URL prefix allowlist, resolve DNS and block private IP ranges.
- Decided by: orchestrator.
- Reason: a prefix such as `https://hooks.slack.com/services/` fixes scheme, host and path in one rule. Development adds the mock receiver's prefix. Redirects are refused, so an allowed URL cannot forward the request elsewhere.

## D-020 Channel descriptors drive the target form

- Options: one Angular form component per channel, a generic form built from a field list in `libs/shared`.
- Decided by: orchestrator.
- Reason: requirement N3 asks that a new channel need no changes outside its own module. A field list keeps the web app out of that change.

## D-021 Zod validation without a Fastify type provider

- Options: `fastify-type-provider-zod`, parsing with zod inside each handler.
- Decided by: orchestrator, after reviewer-opus reported the provider's peer dependencies and the orchestrator confirmed them with `npm view fastify-type-provider-zod@7.0.0 peerDependencies`.
- Reason: version 7.0.0 requires `@fastify/swagger` and `openapi-types` as non-optional peers. The app does not need OpenAPI output on day one. `Schema.parse(request.body)` returns a typed value, and one error handler maps `ZodError` to 400.

## D-022 `pg` driver with drizzle-kit migrations

- Options: `postgres` (postgres.js), `pg` (node-postgres).
- Decided by: orchestrator, after both reviewers noted the design named no driver.
- Reason: `pg` is the most used driver and Drizzle supports it through `drizzle-orm/node-postgres`. Both drivers meet the Drizzle 0.45.4 peer ranges, so the choice has no compatibility cost.

## D-023 No cursor pagination on day one

- Options: `created_at` cursor, `(created_at, id)` cursor, `limit` only.
- Decided by: orchestrator, after both reviewers found that a `created_at` cursor drops rows that share a timestamp.
- Reason: a correct cursor costs time that the 2-hour budget does not have. Admin lists show the newest 200 rows at most.

## D-024 Disabled channels pause queued deliveries

- Options: mark queued rows `skipped` when the worker sees a disabled channel, leave them queued until the channel is enabled again.
- Decided by: orchestrator, after both reviewers found that the draft spent an attempt and then dropped the row for good.
- Reason: an admin may disable a channel for a short outage. Queued rows wait and resume. Rows created while the channel is off are stored as `skipped`, and admin retry now accepts `skipped`.

## D-025 Agents push on request

- Options: only the user pushes, agents push when asked.
- Decided by: user, in prompt 004.
- Rule: the orchestrator pushes only when the current prompt asks for it. It never force-pushes.

## D-026 spartan-ng components live in `libs/ui`

- Options: components inside `apps/web`, a separate library.
- Decided by: implementer subagent, through the spartan CLI default. The orchestrator accepted it.
- Reason: the CLI generates each component as an Nx library and maps it to an import path such as `@spartan-ng/helm/button` in `tsconfig.base.json`. Moving the files would break the CLI for the next component.

## D-027 Strict TypeScript in every project

- Options: strict mode per project, strict mode in the base config.
- Decided by: orchestrator, after reviewer-opus found that the API compiled with `strict: false`.
- Reason: without strict mode, zod infers required fields as optional, so the API would accept code that skips required config. The base config now sets `strict: true`. The API targets ES2024 with no DOM types.

## D-028 API bootstrap is rewritten in M3

- Options: replace the generated `@fastify/autoload` bootstrap in M2, replace it in M3.
- Decided by: orchestrator. Both reviewers asked for `buildApp(config)` as in the design.
- Reason: M3 writes the config loader and every route, so it rewrites `app.ts` anyway. Doing it in M2 would mean writing it twice. The M3 prompt must say to remove `@fastify/autoload` and `@fastify/sensible`.

## D-029 Reviewer files follow the Opus 5.5 prompting guide

- Options: keep the reviewer files as they are, add lines for Opus 5.5 to `reviewer-opus` only, add model-neutral lines to both files.
- Decided by: orchestrator, after the user asked for a check of the reviewer against the guide. See V-016.
- Reason: the guide describes two behaviours that would hurt a reviewer subagent. The model can end its turn with a progress note, which returns a partial review. It also starts work quickly and reads only what the task names. Both new lines are model-neutral, so both files get them and the bodies stay identical, as D-012 requires.
- Consequence: reviews from M3 on use the new body. The M1 and M2 reviews used the old one, because the change was made on a separate branch while M2 ran on main. The notes on the guide are in `docs/prompting-opus-5-5.md`.
- Numbering: this entry was D-026 on the `docs/opus-5-5-prompting` branch. It was renumbered when the branch came into main.

## D-030 jose signs the session JWT

- Options: `@fastify/jwt`, `jose`.
- Decided by: the implementer for prompt 007 chose `jose` without being asked and without reporting it. The orchestrator found it while checking the tree and accepted it.
- Reason: `jose` is maintained by panva (`github.com/panva/jose`), has no dependencies, and lets the code pin HS256 and require `exp` and `sub` in one call. The guards never use the token's role claim, so the plugin's request decorators were not needed. Both M3 reviewers called the choice sound.

## D-031 M3 committed per part, reviewed as a whole

- Options: one M3 commit after review, one commit per implementer part with one review of the combined diff.
- Decided by: orchestrator.
- Reason: M3 ran as six implementer prompts in sequence, because long runs returned no report (V-011, V-017). A commit after each verified part gives every later part a known-good base and lets the orchestrator roll back one part. The two reviewers then read `d637df1..HEAD` in one pass. The review fixes form a separate commit, so the history shows what the review changed.

## D-032 Claim token fences delivery results

- Options: fence result writes on the attempt count, fence on a random token set at each claim.
- Decided by: orchestrator, after reviewer-gpt M3-02.
- Reason: admin retry resets `attempts` to 0, so an old claim and a new claim can carry the same attempt count. A token from `gen_random_uuid()` is different at every claim. The attempt count stays for backoff and the attempt limit.

## D-033 Total send deadline below the lease

- Options: renew the lease while a send runs, wrap each send in a total deadline.
- Decided by: orchestrator, after reviewer-gpt M3-03.
- Reason: Nodemailer's `socketTimeout` limits idle time, so a slow server could keep a send alive past the 60 second lease. A 20 second deadline per send is simpler than lease renewal. `config.ts` rejects a lease below twice the deadline.

## D-034 Plain select and checkbox elements

- Options: spartan native-select and checkbox, the same components edited by hand to drop the icons, plain elements styled with the theme classes.
- Decided by: orchestrator, after the implementer for prompt 019 reported the blocker and the orchestrator confirmed it.
- Reason: both spartan components import `@ng-icons/core` and `@ng-icons/lucide`. `npm view @ng-icons/core` returns 404 on the npm registry this machine is configured to use, so the generated code cannot compile. Editing generated components by hand breaks the next CLI update. Plain elements keep native keyboard behaviour and labels.
- Revisit if the registry serves `@ng-icons`.

## D-035 `apps/web/.env.serve` sets the web port

- Decided by: the implementer for prompt 017 added the file without reporting it. The orchestrator found it in the tree and accepted it.
- Reason: Nx loads the root `.env` into every task, and the root `.env` sets `PORT=3000` for the API. The Angular dev server prefers `PORT` over its `port` option, so `nx serve web` tried to take the API's port. Nx loads a task-specific `.env.serve` before the root file, so `PORT=4200` there wins for the web app only. reviewer-opus traced both rules in the package sources.

## D-036 Keep the commit history and tag the milestones

- Options: squash each milestone into one commit and force-push main, squash only the unpushed M4 commits, keep the history and add annotated tags.
- Decided by: user, after the orchestrator quoted the brief.
- Reason: the brief asks for "commits for each major milestone, with meaningful commit messages", not for one commit each. The separate commits are evidence: `28355cf` and `4b33480` show what the M1 reviews changed, and the `fix:` commits after M3 and M4 show what the code reviews changed. Squashing M0 to M3 would also need a force push of main. Tags `m0` to `m4` and the table in `docs/plan.md` make each milestone easy to find.
