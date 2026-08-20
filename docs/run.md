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

API tests expect Postgres:

```bash
# compose already up, or a CI Postgres service
DATABASE_URL=postgresql+psycopg2://pollscale:pollscale@127.0.0.1:5432/pollscale_test \
  pnpm test:api
```

Local `.env` should set `ALLOW_DEV_AUTH=true` and `EXPO_PUBLIC_ALLOW_DEV_AUTH=true`. Production must leave both unset/false so Apple/Google are the only consumer path.

Admin is separate: `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`, then TOTP. See [admin.md](admin.md).

Onboarding and For You: [onboarding.md](onboarding.md) · [ranking.md](ranking.md).

Push on a simulator: grant the permission prompt. Expo Go on a physical device can receive the v2 types. The simulator often cannot display a real push; the row still lands in **You → Notifications**.
