# Pollscale

Social polling for iPhone and Pixel. One poll at a time. Vote or skip, see the split, next.

v2 is still TestFlight / internal. This repo is a pnpm monorepo. Postgres is the database. There is no SQLite path.

```
apps/mobile    Expo (iOS / Android)
apps/web       Marketing + legal (no voting)
apps/admin     Moderation queue (email + TOTP, not Apple/Google)
apps/api       FastAPI
```

## Run

```bash
cp .env.example .env
docker compose up --build
pnpm install
pnpm --filter @pollscale/mobile start
pnpm --filter @pollscale/web dev
pnpm --filter @pollscale/admin dev
```

API: `http://localhost:8000` (later `https://api.pollscale.com`). Web does not host votes.

More: [docs/run.md](docs/run.md) · [docs/onboarding.md](docs/onboarding.md) · [docs/ranking.md](docs/ranking.md) · [docs/notifications.md](docs/notifications.md) · [docs/admin.md](docs/admin.md)

```bash
cd apps/api && pytest
```

Tests: vote uniqueness, guest quota, skip, reserved usernames, report → queue, flagged poll not public, delete own poll, delete account, 13+ DOB, onboarding topics, For You ranking, admin MFA, pollscale.com domain strings.

## Product
- 13+, English only. Politics allowed. NSFW and self-harm are not.
- Guest wall: 3 votes, persisted. Apple / Google only after that. Then onboarding (name, username, DOB, city, 3+ parent topics).
- For You is the only feed. Follows and Relevant / Not interested change rank. Report does not.
- Publish instantly. AI-flagged polls wait for a human. User sees: *we need a human to look at this, we’ll let you know*.
- Users can delete their own live polls and their account (`support@pollscale.com` / `legal@pollscale.com`).
- Notifications: approved after review, someone voted, someone followed you.

`OPENAI_API_KEY` scores new polls (text + images via `omni-moderation-latest`). Missing key: production fails closed; local/dev queues the post for review instead of publishing it.
