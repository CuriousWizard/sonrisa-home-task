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
- Consequence: the API sends HTTP requests to URLs that users type in, which is a server-side request forgery risk. The API accepts only HTTPS URLs on allowlisted hosts (requirement N4).

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

## D-013 Simulated events on a timer, plus an injection route

- Decided by: user.
- Setup: each source emits an event every 20 to 60 seconds. A route that exists only outside production injects a given event for tests and demos.

## D-014 Cut order

- Decided by: user accepted the orchestrator's proposal.
- Order: metrics page, then the Playwright test, then the admin switches for sources and channels.
