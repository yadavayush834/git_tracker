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
4. Set the webhook URL to `https://your-domain.example/api/github/webhook` and create a strong webhook secret.
5. Grant read-only repository permissions for **Metadata**, **Contents**, **Issues**, and **Pull requests**.
6. Subscribe to `push`, `repository`, `issues`, `pull_request`, `release`, and `installation_repositories` events.
7. Install the App on **All repositories** so repositories created later are included automatically.
8. Set `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET` using the values from GitHub.
9. Set a long random `CRON_SECRET`, then have the scheduler send an authenticated `POST` to `/api/cron/sync` every few hours:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.example/api/cron/sync
```

GitHub webhook signatures are verified before payloads are parsed. Delivery IDs are deduplicated, failed deliveries can be retried, and repositories removed from an installation are soft-marked rather than deleted.

## Data flow

- `/api/github/webhook` receives real-time GitHub changes.
- `/api/cron/sync` reconciles every repository in case a webhook was missed.
- `/api/dashboard` returns a minimal dashboard-safe data object from PostgreSQL.
- The browser automatically prefers stored production data, while keeping demo and username import fallbacks available.
