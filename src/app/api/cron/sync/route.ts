import { syncGitHubInstallation } from "@/data/github-sync";
import { isDatabaseConfigured } from "@/data/repository-store";
import { isGitHubAppConfigured } from "@/lib/github-app";
import { safeSecretEqual } from "@/lib/webhook-signature";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !safeSecretEqual(request.headers.get("authorization"), `Bearer ${cronSecret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isDatabaseConfigured() || !isGitHubAppConfigured()) {
    return Response.json({ error: "Database or GitHub App configuration is missing." }, { status: 503 });
  }
  const installationId = Number(process.env.GITHUB_APP_INSTALLATION_ID);
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return Response.json({ error: "GITHUB_APP_INSTALLATION_ID is invalid." }, { status: 503 });
  }
  try {
    const result = await syncGitHubInstallation(installationId);
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ error: "GitHub reconciliation failed." }, { status: 502 });
  }
}
