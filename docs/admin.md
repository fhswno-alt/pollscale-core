# Add an admin

Admins are an email allowlist. Dave is first.

```bash
# .env / compose
ADMIN_EMAILS=dave@polescale.com,sam@polescale.com
```

They sign in with the same Apple or Google identity as the app. `user.email` must match the list (case-insensitive).

Locally, only if `ALLOW_DEV_AUTH=true`:

```bash
# apps/admin
VITE_ALLOW_DEV_AUTH=true VITE_API_URL=http://localhost:8000 pnpm --filter @pollscale/admin dev
```

Sign in as `dave@polescale.com` / username `daven`. Seed already creates that mailbox.

Do not ship an unlabeled “dev login” in production. Keep `ALLOW_DEV_AUTH` off there.
