import { analyzePendingRepositories } from "@/data/repository-analysis";
import { isDatabaseConfigured } from "@/data/repository-store";
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
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 5);
    const result = await analyzePendingRepositories(Number.isSafeInteger(requestedLimit) ? requestedLimit : 5);
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ error: "Repository analysis failed." }, { status: 502 });
  }
}

export const GET = handleCron;
export const POST = handleCron;
