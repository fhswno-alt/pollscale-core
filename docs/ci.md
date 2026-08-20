# CI

One workflow: `.github/workflows/ci.yml`. Path filters: `.github/path-filters.yml`.

## When jobs run

| Job | Paths |
| --- | --- |
| Secret scan | Every pull request and push |
| API | `apps/api/**`, `docker-compose.yml`, shared |
| Web | `apps/web/**`, shared |
| Admin | `apps/admin/**`, shared |
| Mobile | `apps/mobile/**`, shared |

Shared (fans out to API, web, admin, and mobile):

- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `package.json`
- `.github/workflows/**`
- `.github/path-filters.yml`
- `docker-compose.yml`
- `.gitleaks.toml`

A PR that only touches `apps/mobile/**` does not run API, web, or admin. A PR that only touches `apps/api/**` does not run mobile, web, or admin.

`changes` uses `dorny/paths-filter`. Each app job has `if: needs.changes.outputs.<app> == 'true'`. In-progress runs for the same workflow + ref are cancelled.

## What each job does

- **API** — Python 3.12, pip cache, `ruff check`, pytest against a Postgres 16 service, `docker build` of `apps/api` (no push).
- **Web / Admin** — pnpm from `packageManager` (`pnpm@10.15.0`), store cache, `typecheck`, `lint`, `build`.
- **Mobile** — same pnpm setup, `typecheck`, `lint`, `expo export --platform web` (JS bundle on Ubuntu). No EAS, no Xcode, no Maestro/Detox/Playwright.
- **Secret scan** — Gitleaks in Docker. No extra secrets.

## Adding a path

Edit `.github/path-filters.yml`. Keep shared entries listed once under `shared` and referenced from each app.
