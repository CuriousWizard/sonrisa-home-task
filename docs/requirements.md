# Requirements

## The brief

> We want users to be able to set up alerts so they get notified when something important happens in the world, like breaking news, market movements, natural disasters, that kind of thing. Should work for both email and Slack. Make it flexible enough that we can add more channels later. We need an admin view too.

No product manager is available, so the user acts as the product owner. Answers are in `prompts/prompt-log.md`, entries 002 and 003.

## Terms

| Term | Meaning |
|---|---|
| Event | One thing that happened in the world, such as an earthquake or a 7% drop in a stock price. It has a category, a severity from 1 to 5, and category-specific data. |
| Category | `news`, `market` or `disaster` |
| Source | A component that produces events for one category. On day one, every source is a simulator. |
| Alert | A rule owned by a user: a category, typed filters, a minimum severity, and one or more targets |
| Target | A destination owned by a user, such as an email address or a Slack webhook URL |
| Channel | A delivery mechanism, `email` or `slack`. Each target uses one channel. |
| Delivery | One row that tracks sending one event to one target because of one alert, across all attempts |

"Something important" means an event that matches an alert's filters and has a severity at or above the alert's minimum severity.

## Functional requirements

### Users

- R1. A visitor can register and sign in with an email address and a password.
- R2. A user can create, list and delete targets. An email target has an address. A Slack target has an incoming webhook URL.
- R3. A user can send a test notification to a target. The request fails if an admin has disabled the target's channel.
- R4. A user can create, edit, delete, enable and disable alerts.
- R5. Alert filters depend on the category. In every list filter, an empty list matches any value.
  - news: a list of keywords. An event matches if any keyword appears as a whole word in the title or summary, case-insensitive.
  - market: a list of symbols, a direction of `up`, `down` or `any`, and a minimum absolute change in percent.
  - disaster: a list of types from `earthquake`, `flood`, `storm` and `wildfire`, a list of regions, and a minimum magnitude that applies to earthquakes only.
- R6. Every alert has a minimum severity from 1 to 5.

### System

- R7. Each enabled source produces one event at a random interval between 20 and 60 seconds.
- R8. When an event is stored, the system evaluates it against every enabled alert in the same category.
- R9. For each match, the system creates one delivery per target. The same alert, event and target never produce a second delivery.
- R10. A worker sends pending deliveries. A failed send is retried with exponential backoff, up to 5 attempts in total. After the fifth failure the delivery is marked `dead`.
- R11. If an admin has disabled a channel, new deliveries for that channel are stored with status `skipped`, so the admin can see why nothing was sent. Deliveries that were already queued wait until the channel is enabled again.

### Admin

- R12. An admin can list all users and the alerts each user owns.
- R13. An admin can browse stored events and filter them by category.
- R14. An admin can browse deliveries, filter them by status and channel, and retry a `failed`, `dead` or `skipped` delivery.
- R15. An admin can enable and disable each source and each channel.
- R16. An admin can see metrics for the last 24 hours: events per category, deliveries per status, and failure rate per channel.

### Development and demo

- R17. A route that exists only outside production lets a developer inject a specific event. Tests and demos use it to get predictable results.
- R18. A mock Slack receiver records incoming webhook calls and can be set to fail, so retries can be shown without a Slack workspace.

## Non-functional requirements

- N1. One command starts the stack locally after `docker compose up -d`. A seed script creates one admin and one demo user.
- N2. Passwords are stored as salted hashes. Admin routes check the role on the server.
- N3. Adding a channel needs one new module that implements the channel interface, one config schema with a form descriptor, and one registry entry. Adding a source needs one module and one registry entry.
- N4. A Slack webhook URL must start with a prefix from an allowlist. The default allowlist is `https://hooks.slack.com/services/`. Development adds the mock receiver's prefix.
- N5. Unit tests cover filter matching, severity checks and backoff timing. Integration tests cover the API. One Playwright test covers sign-in, alert creation and delivery.

## Assumptions

- A1. Simulated events are enough to show the design. Real sources plug into the same source interface later.
- A2. A single API process runs the sources and the worker. The worker claims rows with `FOR UPDATE SKIP LOCKED`, so a second process would not send twice.
- A3. All times are stored in UTC.
- A4. The UI is in English.

## Out of scope for day one

- Real data sources
- Notification rate limiting, digest batching and quiet hours. Sign-in rate limiting is in scope.
- Email verification and password reset
- Channels other than email and Slack
- Organisations or teams
- Deployment
