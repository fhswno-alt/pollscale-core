# Run Pollscale

```bash
cp .env.example .env
docker compose up --build
# API http://localhost:8000   Postgres on 5432

pnpm install
pnpm --filter @pollscale/mobile start          # Expo
pnpm --filter @pollscale/web dev               # marketing + legal :5173
pnpm --filter @pollscale/admin dev             # email + TOTP queue :5174
```

API tests expect Postgres. The source of truth is `apps/api/pyproject.toml` + `uv.lock`:

```bash
# compose already up, or a CI Postgres service
cd apps/api && uv sync
DATABASE_URL=postgresql+psycopg2://pollscale:pollscale@127.0.0.1:5432/pollscale_test \
  uv run pytest
# or from the repo root:
# DATABASE_URL=... pnpm test:api
```

`.env.example` ships `ALLOW_DEV_AUTH=false` and `EXPO_PUBLIC_ALLOW_DEV_AUTH=false`. On a laptop, set both to `true` if you need `/auth/dev`. Production (`POLLSCALE_ENV=production`) refuses to boot if either is true, if `JWT_SECRET` is default/short, or if `CORS_ORIGINS` is missing/`*`.

Public host: `https://api.pollscale.com`. CORS should be `https://pollscale.com,https://www.pollscale.com`. Rate limits and Sentry: [observability.md](observability.md).

Admin is separate: `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`, then TOTP. See [admin.md](admin.md).

Onboarding and For You: [onboarding.md](onboarding.md) · [ranking.md](ranking.md).

Analytics (PostHog + Slack + 18:00 Europe/London digests): [analytics.md](analytics.md).

CI path filters and jobs: [ci.md](ci.md).

```bash
docker compose --profile analytics up --build
# PostHog UI http://localhost:8010
```

Push is opt-in. The app does not request notification permission on first login. Copy lives on **You** and **Notifications**; the user taps *Turn on notifications*. Pass `extra.eas.projectId` (from `npx eas init`) into `getExpoPushTokenAsync` when present. Android uses channel `pollscale-default`. Expo Go on a physical device can receive the v2 types. The simulator often cannot display a real push; the row still lands in **You → Notifications**.

JS hotfix later: `apps/mobile/eas.json` + `npx eas init`. No EAS login is required to compile or export.

Mobile Expo SDK is 57 (from 53). See [observability.md](observability.md).
