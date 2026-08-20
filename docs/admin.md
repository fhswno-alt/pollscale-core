# Admin console

Admin is a separate identity from the consumer app. Apple and Google from Pollscale do **not** open this console.

## First admin

Set both values, then start the API once. If `admin_users` is empty, the API creates that mailbox.

```bash
ADMIN_BOOTSTRAP_EMAIL=dave@pollscale.com
ADMIN_BOOTSTRAP_PASSWORD=change-me-now
```

Then:

```bash
pnpm --filter @pollscale/admin dev
```

Sign in at `http://localhost:5174` with that email and password. The first login does not issue a session. It returns a TOTP secret and a QR (Microsoft Authenticator, Google Authenticator, or any TOTP app). Scan or type the secret, then enter the 6-digit code.

After enrollment, password alone is rejected. Login returns `mfa_required`; the access token is issued only from `POST /admin/auth/mfa`.

One-time create without env: insert a row in `admin_users` (bcrypt hash + a pyotp secret) or call `POST /admin/users` once you already have an enrolled admin.

## More admins

From the console, or:

```http
POST /admin/users
Authorization: Bearer <admin access token>
{ "email": "sam@pollscale.com", "password": "at-least-10-chars" }
```

The new person enrolls MFA on first login the same way. Consumer JWTs cannot call `/admin/*`.

## Queue

Flagged polls and reports land here. Approve publishes. Reject / takedown hides the poll and notifies the author. Report is moderation only; it does not change For You ranking.
