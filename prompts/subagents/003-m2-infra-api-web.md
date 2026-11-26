# 003 Finish M2, part 1: infrastructure, API health route, spartan button

Sent to: default implementer subagent. Reason for this prompt: the subagent for prompt 002 stopped partway and returned no report. The orchestrator inspected the working tree and split the rest of M2 into two smaller tasks. Part 2 is prompt 004.

```text
You are the implementer for part of milestone M2 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/.

Read AGENTS.md and the sections "Repository layout", "Configuration" and "Commands" in docs/design.md.

Current state, made by an earlier subagent that stopped without a report:
- Nx 24.0.7 workspace at the root with apps/api (Fastify, generated with @fastify/autoload and @fastify/sensible), apps/web (Angular 22.3), apps/web-e2e (Playwright), libs/shared (placeholder).
- Tailwind 4 through apps/web/.postcssrc.json and @tailwindcss/postcss. The spartan theme is in apps/web/src/styles.css.
- apps/web/proxy.conf.json exists.
- Not done: everything in the task list below.
- Another subagent will fill libs/shared after you. Do not touch libs/shared.

Tasks:
1. Run npx nx run-many -t build lint test first. Fix whatever fails before you add anything.
2. apps/api: replace the generated root route with GET /api/health returning { status: 'ok' }. Read PORT from env, default 3000. Update the generated spec so it tests /api/health.
3. apps/web:
   - Check that proxy.conf.json sends /api to http://localhost:3000 and that the serve target uses it.
   - Add the spartan button component with the spartan CLI. Run the generator with --help first and use only flags that exist.
   - Replace the Nx welcome page with a minimal home page that renders one spartan button and uses a few Tailwind utilities. Delete nx-welcome.ts. Update the generated app spec so it passes.
4. Dependency hygiene. Check each with npm view before changing it:
   - @angular/cdk is pinned to 22.0.0 while Angular is ~22.3.0. Align it with the Angular version if a matching release exists.
   - @types/node is ^22 while the runtime is Node 26. Align it with Node 26 if a matching release exists.
5. Infrastructure:
   - docker-compose.yml with postgres:18-alpine and axllent/mailpit. Bind ports to 127.0.0.1 only: 5432 for Postgres, 1025 and 8025 for Mailpit. User, password and database are alerts, alerts, alerts. Add a Postgres healthcheck with pg_isready. The postgres:18 image changed its data directory layout; read the image documentation and use the volume mount path it gives for version 18.
   - docker/postgres-init.sql that creates the alerts_test database, mounted into /docker-entrypoint-initdb.d.
   - .env.example with exactly the variables in the Configuration section of docs/design.md. Make sure .env is in .gitignore.
   - scripts/setup.mjs, plain Node with no dependencies: if .env is missing, copy .env.example to .env and replace the JWT_SECRET placeholder with crypto.randomBytes(48).toString('base64url'); then run docker compose up -d --wait and fail with a clear message if it fails. Leave one comment line marking where M3 adds migrate and seed.
   - Root package.json: scripts setup, dev (serve api and web together through nx run-many), build, test, lint, e2e. Add "engines": { "node": ">=26" }.

Verification you must run, and report each result in one line:
- npx nx run-many -t build lint test
- npm run setup, then docker compose ps showing both services healthy
- docker compose exec postgres psql -U alerts -lqt, showing alerts_test
- start the API, curl http://localhost:3000/api/health, stop the API
- grep the built web CSS for one Tailwind utility class used on the home page
- git status --short

Report back in under 400 words:
1. Commands run, one line each with the result.
2. Files added or changed.
3. Versions changed and the npm view output that justified each change.
4. Deviations from the design or this prompt, and why.
5. What you could not verify.
```
