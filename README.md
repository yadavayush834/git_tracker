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

The next production milestone is a GitHub App installation, webhook ingestion, PostgreSQL persistence, and scheduled reconciliation.
