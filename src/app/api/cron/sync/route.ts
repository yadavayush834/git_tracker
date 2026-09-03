import { syncGitHubInstallation } from "@/data/github-sync";
import { getInstallationIds, isDatabaseConfigured } from "@/data/repository-store";
import { isGitHubAppConfigured } from "@/lib/github-app";
import { safeSecretEqual } from "@/lib/webhook-signature";

async function handleCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !safeSecretEqual(request.headers.get("authorization"), `Bearer ${cronSecret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isDatabaseConfigured() || !isGitHubAppConfigured()) {
    return Response.json({ error: "Database or GitHub App configuration is missing." }, { status: 503 });
  }
  try {
    const configuredId = Number(process.env.GITHUB_APP_INSTALLATION_ID);
    const installations = Number.isSafeInteger(configuredId) && configuredId > 0
      ? [{ id: configuredId }]
      : await getInstallationIds();
    if (installations.length === 0) return Response.json({ error: "No GitHub App installation is connected." }, { status: 409 });
    const results = [];
    for (const installation of installations) results.push(await syncGitHubInstallation(installation.id));
    return Response.json({ ok: true, installations: results });
  } catch {
    return Response.json({ error: "GitHub reconciliation failed." }, { status: 502 });
  }
}

export const GET = handleCron;
export const POST = handleCron;
