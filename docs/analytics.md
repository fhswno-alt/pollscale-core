# Analytics

Registry: `apps/api/app/analytics.py` → `SERVER_EVENTS` / `SLACK_INSTANT`.
Mobile funnel names: `apps/mobile/src/lib/analytics.ts` → `FUNNEL_EVENTS`.

The API is the source of truth. PostHog also gets the onboarding funnel from the app.

## Server events

| event | Slack | when |
| --- | --- | --- |
| `user_signed_up` | instant | First Apple / Google (or local Dev) create |
| `user_onboarded` | no | Onboarding saved |
| `poll_created` | no | New poll |
| `poll_flagged` | instant | AI `pending_review` |
| `poll_voted` | no | Vote (guest or signed in) |
| `poll_skipped` | no | Skip |
| `poll_reported` | instant | Report |
| `poll_deleted` | no | Author deletes their poll |
| `account_deleted` | instant | Account wipe |

Instant Slack (`#app-notifications` via `SLACK_WEBHOOK_URL`): first name, Apple/Google, city if present. **No email.** If the webhook is unset, the API logs and continues.

Adding a server event:

```python
# apps/api/app/analytics.py
SERVER_EVENTS = frozenset({..., "poll_milestone"})
# then, wherever it happens:
track("poll_milestone", user=user, properties={"poll_id": poll.id})
```

Put the name in `SLACK_INSTANT` only if it should page Slack every time.

## Mobile funnel

`onboarding_started`, `onboarding_name`, `onboarding_username`, `onboarding_dob`, `onboarding_city`, `onboarding_interests`, `onboarding_completed`, `first_vote`.

`first_vote` fires on the first signed-in vote if they did **not** already use the guest wall.

Identify: app user id after sign-in. Guests: `device:<id>`.

## PostHog (local compose, not a Hetzner production deploy)

```bash
docker compose --profile analytics up --build
# UI http://localhost:8010
# First open: create a project, copy the project API key
```

```bash
# .env  — API talks to the compose service
POSTHOG_HOST=http://posthog:8000
POSTHOG_PROJECT_API_KEY=phc_...

# Expo / host browsers use the published port
EXPO_PUBLIC_POSTHOG_HOST=http://localhost:8010
EXPO_PUBLIC_POSTHOG_PROJECT_API_KEY=phc_...
```

If `POSTHOG_PROJECT_API_KEY` is unset, capture is a no-op.

## Slack webhook

In workspace **pollscale**, create an incoming webhook for **#app-notifications**. Set `SLACK_WEBHOOK_URL`. Leave it blank in local `.env` if you do not want Slack.

## Digests (Europe/London)

APScheduler in the API, daily **18:00 Europe/London**. Same tick also posts:

- week — if Sunday
- month — if last day of the month
- quarter — if last day of Mar / Jun / Sep / Dec

Body: `134 users total, plus 24 today.` Idempotent via `analytics_digests.period_key`.
