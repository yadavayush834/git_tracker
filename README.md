# RepoPulse

A personal GitHub project dashboard built with Next.js. RepoPulse imports your repositories, suggests useful project statuses, highlights stale and empty work, and turns recent GitHub events into a compact progress view.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The dashboard starts in demo mode. Select **Connect GitHub** and enter a username to import public repositories.

To include private repositories, create a fine-grained GitHub token with read-only repository access and set `GITHUB_TOKEN` in `.env.local`. Secrets are read only by the server route and are never included in the browser bundle.

## Current milestone

- Responsive overview, repository library, and activity stream
- Public GitHub repository and event import
- Optional private repository import using a server-side token
- Automatic Empty, Started, In progress, Stale, and Completed suggestions
- Persistent manual status overrides in the browser
- Search and status filters
- Demo dataset for zero-configuration preview

## Production GitHub App setup

1. Create a PostgreSQL database and set `DATABASE_URL`.
2. Run `npm run db:migrate` to apply the generated schema.
3. Create a GitHub App under **Settings → Developer settings → GitHub Apps**.
4. Set its callback URL to `https://your-domain.example/api/auth/callback/github`.
5. Set its post-installation setup URL to `https://your-domain.example/api/github/install/callback` and enable redirect-on-update.
6. Set the webhook URL to `https://your-domain.example/api/github/webhook` and create a strong webhook secret.
7. Grant read-only repository permissions for **Metadata**, **Contents**, **Issues**, and **Pull requests**.
8. Subscribe to `push`, `repository`, `issues`, `pull_request`, `release`, and `installation_repositories` events.
9. Install the App on **All repositories** so repositories created later are included automatically.
10. Set the `GITHUB_APP_*` variables, `GITHUB_WEBHOOK_SECRET`, `AUTH_SECRET`, and `OWNER_GITHUB_LOGIN` using the values from GitHub.
11. Set a long random `CRON_SECRET`, then have the scheduler send authenticated requests to the cron endpoints.

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.example/api/cron/sync
```

GitHub webhook signatures are verified before payloads are parsed. Delivery IDs are deduplicated, failed deliveries can be retried, and repositories removed from an installation are soft-marked rather than deleted.

## Data flow

- `/api/github/webhook` receives real-time GitHub changes.
- `/api/cron/sync` reconciles every repository in case a webhook was missed.
- `/api/cron/analyze` inspects authorized repository trees and key manifests in small batches.
- `/api/dashboard` returns a minimal dashboard-safe data object from PostgreSQL.
- `/api/auth/*` provides GitHub sign-in and protects stored private dashboard data.
- The browser automatically prefers authenticated stored data, while keeping demo and username import fallbacks available during development.

## What repository “understanding” means

RepoPulse does not scrape GitHub pages. It uses short-lived GitHub App installation tokens and official API endpoints. The analysis worker reads the authorized repository tree plus a small set of useful manifests such as `package.json`, `pyproject.toml`, `go.mod`, and `Cargo.toml`.

For each repository it stores:

- Detected project type and framework
- Whether README, tests, CI, licensing, and deployment configuration exist
- Repository health score and file count
- A structural summary
- A recommended next action

It does not execute repository code, expose installation tokens to the browser, or copy every source file into the database.

## Deploy on Vercel

1. Push this directory to a private GitHub repository and import it into Vercel.
2. Add a PostgreSQL provider such as Neon from **Vercel → Storage** and map its connection string to `DATABASE_URL`.
3. Add every variable from `.env.example` to the Vercel project.
4. Deploy once, then run `npm run db:migrate` with the production `DATABASE_URL`.
5. Update the GitHub App callback, setup, homepage, and webhook URLs to the final Vercel domain.
6. Install the GitHub App from the dashboard and select all or selected repositories.

`vercel.json` schedules a daily safety reconciliation and a daily analysis batch. Real-time changes still arrive through webhooks.
