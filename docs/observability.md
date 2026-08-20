# Observability

Crashes and API failures should show up in Sentry before a user emails support. Nothing here requires a paid EAS plan or a Hetzner login.

## DSN

| Where | Env | Notes |
| --- | --- | --- |
| API | `SENTRY_DSN` | FastAPI + Starlette integration. Unset = no-op. The process must not crash. |
| Mobile | `EXPO_PUBLIC_SENTRY_DSN` | `@sentry/react-native`. Unset = no-op. Root `ErrorBoundary` still shows Retry. |

Create a Sentry org/project yourself (out of scope for this repo). Same DSN can be used for both if you want one project; two projects is cleaner.

`.env` example:

```
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
EXPO_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
EXPO_PUBLIC_SENTRY_ENVIRONMENT=production
```

`POLLSCALE_ENV` is sent as the API environment tag.

## Source maps

Native source maps need an Expo/EAS upload hook. The Sentry config plugin is only added when both are set:

```
SENTRY_ORG=your-org
SENTRY_PROJECT=pollscale-mobile
```

Then `npx eas init` (see below) and a production build can upload maps. Without those vars, JS still reports with minified frames. That is enough to know *that* a crash happened.

API source maps are not used (Python).

## Verify a test event

1. Set the DSN locally. Restart the API / reload Expo.
2. API (never registered in production):

```bash
curl -X POST http://localhost:8000/debug/sentry
# {"status":"sent","message":"sentry-test"}   when DSN is set
# {"status":"noop","reason":"SENTRY_DSN unset"} when it is not
```

In Sentry you should see `RuntimeError: sentry-test`.

3. Mobile: with `EXPO_PUBLIC_SENTRY_DSN` set, throw from a screen or call `captureException(new Error("sentry-test"))` from `src/lib/sentry.ts`. The root ErrorBoundary also reports real render crashes and shows Retry.

Production `/debug/sentry` is 404.

## What is reported

- Unhandled API exceptions (middleware).
- `/health` database failures (503 + capture).
- Mobile: render crashes, 5xx and network failures, vote / feed / skip / push / sign-in errors. 4xx such as `guest_quota_exceeded` stay in the UI and are not sent as server errors.

Vote, feed, and push failures are not treated as “caught up” or swallowed. For You shows **Couldn’t load For You** + Retry when the request fails. An empty feed with a 200 is still caught up.

## EAS / JS hotfix

`apps/mobile/eas.json` is a starter profile. It does **not** contain a project id.

```bash
cd apps/mobile
npx eas init
```

That writes `extra.eas.projectId` into the Expo config. `getExpoPushTokenAsync` reads that id when present. `expo-updates` is installed and enabled so a later EAS Update can ship a JS hotfix. No EAS credentials are required to typecheck or `expo export`.

## api.pollscale.com

Production API hardening (boot refuses unsafe defaults):

- `POLLSCALE_ENV=production`
- `JWT_SECRET` must be 32+ characters and not a documented default (`change-me-in-production`, `dev-only-change-me`, …)
- `ALLOW_DEV_AUTH` must be false (`/auth/dev` stays 404)
- `CORS_ORIGINS` must be an explicit list, e.g. `https://pollscale.com,https://www.pollscale.com`. `*` refuses boot.

Rate limits (in-memory, per client IP, `X-Forwarded-For` honored):

| Route | Limit |
| --- | --- |
| `POST /auth/apple`, `/auth/google`, `/auth/dev` | 20 / minute |
| `POST /polls/{id}/vote`, `/polls/{id}/skip` | 60 / minute |

429 body: `{"detail":"rate_limited"}` with `Retry-After`.

`GET /health` runs `SELECT 1` against Postgres. `{ "status": "ok", "db": "ok" }` or 503 `database_unavailable`.

Google identity tokens are signature-verified in production. The unsigned `tokeninfo` fallback is development only.

Put a reverse proxy in front of uvicorn for TLS. This repo does not SSH to Hetzner.

## Expo SDK

Mobile is on **Expo SDK 57** (React Native 0.86). That is a jump from 53. The SDK 57 changelog calls it a small step from 56; the 53→57 range is larger, but this app has no Reanimated UI. CI `expo export --platform web` is the compile gate. `expo-glass-effect` 57 is imported in JS (guarded + Reduce Transparency fallback). It is **not** listed as an Expo config plugin — the package has no `app.plugin.js` and that broke web export. `UIDesignRequiresCompatibility` is not set.
