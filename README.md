# Pollscale

Social polling for iPhone and Pixel. One poll at a time. Vote or skip, see the split, next.

v1 is TestFlight / internal — not store-ready.

## What’s in this repo

```
api/                 FastAPI + SQLAlchemy
mobile/              Expo (iOS, Android, web)
docker-compose.yml   Postgres + API (+ MinIO for optional S3)
```

- Multiple choice, 2–4 options
- Optional photo on the question and on each option
- Photo A vs B is just a two-option photo poll
- Guest wall after exactly 3 votes (persisted on device and enforced by the API)
- Apple and Google sign-in only (local/dev can complete those buttons without IdP credentials)
- Anyone signed in can create a poll
- Follow topics and follow people
- Images go to Hetzner S3-compatible storage when configured, otherwise local disk / MinIO

Production API will live at `https://api.polescale.com`. Locally it is `http://localhost:8000`.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

The API creates tables and seeds polls on first boot (`AUTO_SEED=true`).

Re-seed an empty database:

```bash
docker compose exec api python -m scripts.seed
```

API: `http://localhost:8000/health`

## Run the API without Docker

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# SQLite is the default when DATABASE_URL is unset
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Tests:

```bash
cd api
python3 -m pytest
```

Covered: vote uniqueness, guest quota, skip (skip does not vote and does not consume the 3 free votes).

## Run the Expo app

```bash
cd mobile
npm install
npx expo start
```

Then open iOS Simulator, Android emulator, Expo Go, or press `w` for web.

Point the app at the API:

```bash
# iOS simulator / web
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start

# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npx expo start

# Physical device — use your machine LAN IP
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000 npx expo start
```

`EXPO_PUBLIC_ALLOW_DEV_AUTH` defaults to `true` so **Continue with Apple** and **Continue with Google** complete a local identity when real IdP keys are missing. Set real `APPLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` (and `EXPO_PUBLIC_GOOGLE_CLIENT_ID`) when you have them.

## Guest wall

A new install can answer **3** polls. Skip does not count. After the third vote — or if the app is killed and reopened after those 3 — the “Keep going.” sheet blocks voting, posting, and follow until Apple or Google sign-in. The used quota is stored on device (`pollscale.guest_votes`) and also enforced server-side by `X-Device-Id`.

## Object storage

Set these for Hetzner (or any S3-compatible endpoint):

```
S3_ENDPOINT
S3_ACCESS_KEY
S3_SECRET_KEY
S3_BUCKET
S3_REGION
S3_PUBLIC_URL
```

If they are empty, uploads land in `MEDIA_DIR` and are served at `/media`. Compose includes MinIO on `:9000` if you want a local S3 stand-in.

## Product loop to click through

1. Compose up / start the API (seeded)
2. Start Expo
3. Vote the cabin vs penthouse photo poll, see bars + percents, **Next poll**
4. Skip one
5. Vote two more as a guest — wall appears: *Keep going.*
6. Continue with Apple or Google
7. Follow a topic (tap the chip or Topics) and a person
8. **+** → New poll → Post
