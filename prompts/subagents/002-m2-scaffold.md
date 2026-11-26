# 002 Implement M2: workspace, Docker Compose, shared library

Sent to: default implementer subagent.

```text
You are the implementer for milestone M2 in /home/davidt/project/sonrisa-home-task. The orchestrator will check your work, two reviewers will review it, and the orchestrator will commit. Do not commit, push or amend.

Read first:
- AGENTS.md
- docs/design.md, in full. It is the contract. The sections "Repository layout", "Shared library", "Configuration" and "Commands" apply to this task.

Environment: Linux, Node v26.13.1, npm 11.20, Docker 29.10.1 with Compose v5.8.0. Versions checked by the orchestrator with npm view: nx and @nx/* 24.0.7, @angular/core 22.3.0, @spartan-ng/brain and @spartan-ng/cli 1.10.1, fastify 5.12.8, zod 4.x.

Goal: a building Nx workspace with three projects, the local infrastructure, and the shared zod library. No business logic in the API or the web app yet.

Tasks:

1. Nx workspace at the repository root, npm as package manager, no Nx Cloud.
   - The repository already has files that must survive unchanged: README.md, AGENTS.md, docs/, prompts/, .github/, .agents/. Merge .gitignore; keep its existing line.
   - One way: generate a workspace in /tmp with create-nx-workspace@24.0.7 and copy it in. Another: nx init. Pick one and say which.
   - Before using any generator, run it with --help and use only flags that exist. Do not guess flags.

2. Projects, at these paths:
   - apps/api: Node application with Fastify 5. Keep only a GET /api/health route that returns { status: 'ok' }. Port from env PORT, default 3000.
   - apps/web: Angular 22 application, standalone, esbuild-based builder, Vitest for unit tests if the generator offers it. Add a dev-server proxy so /api goes to http://localhost:3000.
   - apps/web-e2e: Playwright project, if the Angular generator creates it. Leave it with the generated sample test.
   - libs/shared: TypeScript library importable as @alerts/shared from both apps. Vitest for tests.

3. Tailwind 4 and spartan-ng in apps/web.
   - Set up Tailwind 4 the way Angular 22 with the esbuild builder supports it. Check the current docs; Tailwind 4 setup differs from Tailwind 3.
   - Initialize spartan-ng with its CLI and add the button component only. Render one spartan button on the placeholder home page to prove the pipeline works.
   - If spartan-ng does not work after a reasonable attempt, stop that step, leave Tailwind working, and report exactly what failed. Do not switch to Angular Material; that is the orchestrator's decision.

4. libs/shared, as described in "Shared library" in docs/design.md, using zod 4:
   - Category, Region, Severity, DisasterType, Role, DeliveryStatus
   - per-category event data schemas and alert filter schemas, with no category field inside them
   - EventInput and AlertInput as discriminated unions on the top-level category
   - the channels map with configSchema, label and fields per channel, and TargetInput as a discriminated union on channel. Build TargetInput from the map if it stays type-safe; otherwise list the branches in the same file as the map.
   - RegisterInput and LoginInput: email normalized to lowercase, password at least 10 characters
   - MockSlackMessage, PatchEnabled, ListQuery with limit default 50 and max 200
   - response DTO types for users, targets, alerts, events, deliveries, sources, channels and metrics, as described in the HTTP API section
   - unit tests that prove the discriminators work: AlertInput rejects market filters under category news, EventInput rejects disaster data under category market, TargetInput rejects a slack config under channel email. Also severity bounds and the password minimum. Each test must fail if the rule it covers is removed.

5. Infrastructure, as described in "Configuration":
   - docker-compose.yml with postgres:18-alpine and axllent/mailpit. Bind ports to 127.0.0.1 only. Add a healthcheck for Postgres. The postgres:18 image changed its data directory layout; check the image documentation for the correct volume mount path.
   - docker/postgres-init.sql that creates the alerts_test database.
   - .env.example with every variable listed in the design. Make sure .env is git-ignored.
   - scripts/setup.mjs: if .env is missing, copy .env.example to .env and replace the JWT_SECRET placeholder with a random 48-byte base64url value; then run docker compose up -d --wait. Leave a clearly marked spot where M3 will add migrate and seed.
   - root package.json scripts: setup, dev (serve api and web together), build, test, lint, e2e. Add "engines": { "node": ">=26" }.

Verification you must run and report:
- npx nx run-many -t build lint test, for all projects. All must pass.
- npm run setup, then docker compose ps showing both services healthy, then psql or docker exec showing that alerts_test exists.
- Start the API and curl /api/health.
- npx nx build web and confirm the built CSS contains Tailwind utilities used on the home page.
- npm ls for nx, @angular/core, fastify, zod, tailwindcss, @spartan-ng/brain: report the installed versions.
- git status --short at the end.

Rules:
- Do not edit docs/, prompts/, AGENTS.md or .github/.
- No secrets in tracked files. .env must not be tracked.
- No features beyond this list. No auth, database schema or routes other than /api/health; those are M3.
- Keep comments rare and short.

Report back, in this order:
1. Approach used for the workspace and why.
2. Commands run, each with a one-line result.
3. Installed versions.
4. File tree of new top-level folders, two levels deep, excluding node_modules.
5. Every place where you deviated from docs/design.md or this prompt, and why.
6. Anything you were unsure about or could not verify.
```
