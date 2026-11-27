# 007 Implement M3, part a: config, database, auth, app factory

Sent to: default implementer subagent. M3 is split into four parts that run one after another: a (this prompt), b (channels, targets, alerts, matching), c (sources, ingest, worker, dev routes), d (admin routes). Checked against `docs/prompting-opus-5-5.md`: the prompt names the files to read first and ends with the implementer block.

```text
You are the implementer for part a of milestone M3 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md or .github/. Do not touch apps/web or apps/web-e2e.

Read these first, in full: AGENTS.md, docs/requirements.md, docs/design.md, docs/decision-log.md entries D-015 to D-028, every file under libs/shared/src, and every file under apps/api. The design is the contract. Where this prompt and the design disagree, follow this prompt and report the difference.

Environment:
- Node 26.13.1. Postgres 18 runs at 127.0.0.1:5432 with user, password and database alerts; the database alerts_test also exists. Mailpit runs at 127.0.0.1:1025 (SMTP) and 127.0.0.1:8025 (HTTP).
- Your shell cannot reach the Docker socket. Do not run docker commands. Reach Postgres and Mailpit over TCP.
- .env exists at the repository root and holds a real JWT secret. Never print its contents.
- Package versions checked by the orchestrator with npm view: drizzle-orm 0.45.4, drizzle-kit 0.31.11, pg 8.23.1, @types/pg 8.23.1, @fastify/jwt 10.2.9, @fastify/cookie 11.1.5, @fastify/rate-limit 11.3.0, nodemailer 10.6.1, @types/nodemailer 8.0.2, tsx 4.23.15 (already installed). Add the runtime packages as dependencies and the type and tooling packages as devDependencies. If nodemailer 10 ships its own types, skip @types/nodemailer and say so.

Tasks:

1. Remove the generated bootstrap (decision D-028). Delete apps/api/src/app/ with its autoload plugins, routes and spec. Remove @fastify/autoload and @fastify/sensible from package.json.

2. apps/api/src/config.ts: export loadConfig(env) that parses every variable in .env.example with zod and returns a typed Config.
   - NODE_ENV is development, test or production.
   - Numbers are coerced and must be positive integers.
   - JWT_SECRET must be at least 32 characters and must not equal the placeholder in .env.example.
   - SLACK_WEBHOOK_ALLOWED_PREFIXES is a comma-separated list. Each entry must parse as a URL, end with "/", and have no username or password. An http: entry is allowed only when NODE_ENV is not production.
   - Error messages name the variable but never print a secret value.

3. Database, in apps/api/src/db:
   - schema.ts: every table, column, constraint, index and default in the "Data model" section of the design. Use check constraints for role, min_severity, severity and delivery status. Use the cascade rules the design gives.
   - client.ts: createDb(url) returning the drizzle instance and the pg Pool, so callers can close the pool.
   - apps/api/drizzle.config.ts and the first migration, generated with drizzle-kit into apps/api/src/db/migrations. Read the generated SQL and check it against the design before you go on.
   - migrate.ts: applies the migrations to DATABASE_URL and then to TEST_DATABASE_URL.
   - seed.ts: creates the admin and the demo user from the SEED_* variables. Running it twice must not fail or create duplicates.
   - Root package.json scripts: db:generate, db:migrate, db:seed. They must load .env from the repository root.
   - scripts/setup.mjs: replace the M3 comment with calls to db:migrate and db:seed.

4. Passwords, apps/api/src/auth/password.ts, as in the design's Security table: node:crypto scrypt, N 16384, r 8, p 1, 64-byte key, 16-byte random salt, stored as scrypt$N$r$p$salt$hash with base64url parts, compared with timingSafeEqual. verifyPassword returns false for a malformed stored value instead of throwing.

5. apps/api/src/app.ts: export buildApp(config, deps) where deps holds the drizzle instance. It returns the Fastify instance without listening.
   - Register @fastify/cookie, @fastify/jwt and @fastify/rate-limit with global set to false.
   - JWT: HS256 only for signing and verifying, read only from the cookie named session, expiry 8 hours, claims sub and role.
   - Remove Fastify's default text/plain parser.
   - Error handler: a ZodError becomes 400 with the issue messages. A unique violation on users.email becomes 409. Any other error keeps Fastify's default handling, and a 500 never returns a stack trace or SQL.
   - Routes: GET /api/health and the auth routes below.

6. Auth, apps/api/src/auth:
   - requireUser: verifies the cookie token, loads the user by sub from the database, answers 401 if the token is invalid or the user is gone, and attaches the database row to the request under a typed property. Do not use the token's role claim for any decision.
   - requireAdmin: runs requireUser, then answers 403 unless the database role is admin.
   - POST /api/auth/register: RegisterInput from @alerts/shared, role user, 201, sets the cookie, returns UserDto.
   - POST /api/auth/login: LoginInput, 200 with the cookie and UserDto, or 401 with one generic message for an unknown email or a wrong password.
   - POST /api/auth/logout: requireUser, clears the cookie with the same path, 204.
   - GET /api/auth/me: requireUser, returns UserDto.
   - Cookie options: HttpOnly, SameSite Strict, Path /, no Domain, Secure only in production, max age 8 hours.
   - Rate limit on register and login: AUTH_RATE_LIMIT_MAX requests per minute per IP.

7. apps/api/src/main.ts: load .env from the repository root with process.loadEnvFile if the file exists, call loadConfig, create the database, build the app, and listen on PORT with host localhost. Close the pool on SIGINT and SIGTERM.

8. Unit tests with Vitest, next to the code:
   - password: verify accepts the right password, rejects a wrong one, returns false for a malformed value, and two hashes of the same password differ.
   - config: accepts the values in .env.example with a valid secret; rejects the placeholder secret, a 31-character secret, a prefix without a trailing slash, a prefix with a username, and an http: prefix in production.
   - auth routes with app.inject against the alerts_test database: register then me; a duplicate register gives 409; login with a wrong password gives 401; logout then me gives 401; a cookie signed with another secret gives 401; a user whose row was deleted gives 401. Clean up the rows each test creates. Read TEST_DATABASE_URL from .env; skip nothing.

Verification you must run, and report each in one line:
- npm run db:migrate, then npm run db:seed twice
- psql is not available to you; list the tables through a short node or tsx script against both databases instead
- npx nx run-many -t build lint test --skip-nx-cache
- start the API with npx nx serve api in the background, then with curl and a cookie jar: GET /api/health, POST /api/auth/login as the seeded user, GET /api/auth/me, POST /api/auth/logout, GET /api/auth/me again. Report the status codes. Stop the server.
- a request with Content-Type text/plain to /api/auth/login, and its status code
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 450 words:
1. Files added, changed and deleted.
2. Package versions added.
3. Command results, one line each.
4. Anything in the generated migration SQL that differs from the design.
5. Deviations from the design or this prompt, and why.
6. What you could not verify.
```
