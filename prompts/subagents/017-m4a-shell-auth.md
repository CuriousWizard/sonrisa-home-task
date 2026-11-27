# 017 Implement M4, part a: app shell, auth pages, components

Sent to: default implementer subagent. Checked against `docs/prompting-opus-5-5.md`: the prompt names the files to read, lists the visual patterns to avoid by name, as the frontend design section asks, and ends with the implementer block. M4 runs in three parts: a (this prompt), b (targets and alerts pages), c (admin pages).

```text
You are the implementer for part a of milestone M4 in /home/davidt/project/sonrisa-home-task. Do not commit, push or amend. Do not edit docs/, prompts/, AGENTS.md, .github/ or apps/api. Edit apps/web, libs/ui (through the spartan CLI), libs/shared/src/lib/channels.ts, and package.json only if the CLI adds a dependency.

Read first: AGENTS.md; the "Web app" and "HTTP API" sections of docs/design.md; libs/shared/src/index.ts and the files it exports, especially auth.ts and channels.ts; apps/api/src/auth/routes.ts to see the exact responses; every file under apps/web/src; components.json; libs/ui/button and libs/ui/utils.

Environment: Node 26, Angular 22.3, Nx 24.0.7, spartan-ng 1.10.1 with Tailwind 4. The API runs on port 3000 when started with npx nx serve api; the web dev server on 4200 proxies /api to it, so the browser sees one origin and the session cookie works. Seeded users are in .env.example. No Docker access. Never print .env.

Tasks:

1. Shared library fix deferred from M2 review (F6): in libs/shared/src/lib/channels.ts, type ChannelField so that key must be a key of that channel's config. A typo in a key must fail to compile. Keep the channels map and TargetInput working, and run the shared tests.

2. spartan components. Add these with the spartan CLI, one at a time, the same way libs/ui/button was added (NX_DAEMON=false npx nx g @spartan-ng/cli:ui --name=<name> --directory=libs/ui): input, label, card, table, native-select, checkbox, switch, badge, alert, separator. If one fails, report it and go on with the rest.

3. Angular setup in apps/web:
   - provideHttpClient with fetch. No base URL; requests go to /api on the same origin.
   - An API service per area is fine, but keep request and response types from @alerts/shared. Do not redefine DTOs in the web app.
   - authStore: loads GET /api/auth/me once, keeps the user in a signal, exposes isAdmin, login, register and logout.
   - authGuard sends signed-out users to /login. adminGuard sends non-admins to /alerts.
   - An HTTP interceptor sends the user to /login when any request other than /api/auth/me returns 401.

4. Layout and pages:
   - A top bar with the app name "Alerts" on the left; links to Alerts and Targets for every signed-in user; links to Users, Events, Deliveries, Settings and Metrics only for admins; the user's email and a Sign out button on the right.
   - /login and /register: one card each with email and password, server errors shown under the form, a link to the other page. After success go to /alerts.
   - Routes for every page in the design's Web app table. Pages that parts b and c will build get a placeholder component with the page title only.
   - / redirects to /alerts. Unknown paths redirect to /alerts.
   - Remove the current placeholder home page.

5. Visual direction. This is an operations tool that people scan. Follow these:
   - Neutral palette from the spartan theme already in styles.css, with one accent colour for primary buttons and links.
   - Left-aligned pages inside a max-width container, a page title and one plain sentence under it.
   - Labels above inputs, one column, errors as plain text under the field.
   Avoid these patterns by name:
   - gradient backgrounds or gradient text
   - purple, indigo or violet as the main colour
   - glass or blur effects, and drop shadows on every card
   - pill-shaped buttons
   - emoji anywhere in the UI
   - a hero section, marketing copy or "Welcome back" greetings
   - an icon next to every label or heading
   - entry animations
   - a dark-mode toggle
   UI text: short plain sentences, no exclamation marks.

6. Accessibility, so Playwright in M5 can use role and label locators: every input has a visible label tied to it, buttons have text, the nav is a nav element, and each page has one h1.

7. Tests with Vitest, next to the code:
   - authStore: me succeeds, me returns 401, logout clears the user.
   - authGuard and adminGuard: allow and redirect cases.
   - login page: shows the server error message on 401.

Verification you must run, and report each in one line:
- npx nx run-many -t build lint test --skip-nx-cache
- start the API (npx nx serve api) and the web app (npx nx serve web) in the background; with curl through http://localhost:4200, check that /api/health answers through the proxy and that GET / returns the app's index.html; stop both and any processes they left
- git status --short

Your last message goes back to the orchestrator, which cannot reply to you. Finish every task in this prompt before you return. Do not end with a summary that announces the next step, with an offer to do more, or with a list of choices that do not block the work. Stop early only when a task cannot go on without the user. Then name the blocker and list what you finished.

The report, in under 350 words:
1. Files added or changed, grouped by folder.
2. spartan components added, and any that failed.
3. How ChannelField is typed now.
4. Command results, one line each.
5. Deviations from the design or this prompt, and why.
6. What you could not verify.
```
