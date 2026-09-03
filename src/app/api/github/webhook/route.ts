import {
  beginWebhookDelivery,
  finishWebhookDelivery,
  isDatabaseConfigured,
  markRepositoryRemoved,
  recordActivity,
  upsertInstallation,
  upsertRepository,
} from "@/data/repository-store";
import type { GitHubWebhookPayload } from "@/lib/github-types";
import { verifyGitHubWebhookSignature } from "@/lib/webhook-signature";

const MAX_WEBHOOK_BYTES = 1_000_000;

function eventTitle(event: string, payload: GitHubWebhookPayload) {
  if (event === "push") return { type: "push" as const, title: `Pushed ${payload.commits?.length ?? 0} commits`, detail: payload.head_commit?.message ?? "Updated the repository", commitCount: payload.commits?.length ?? 0 };
  if (event === "pull_request" && payload.pull_request) return { type: "pull_request" as const, title: `${payload.pull_request.merged ? "Merged" : payload.action === "closed" ? "Closed" : "Updated"} pull request #${payload.pull_request.number}`, detail: payload.pull_request.title, commitCount: 0 };
  if (event === "issues" && payload.issue) return { type: "issue" as const, title: `${payload.action === "closed" ? "Closed" : "Updated"} issue #${payload.issue.number}`, detail: payload.issue.title, commitCount: 0 };
  if (event === "release" && payload.release) return { type: "release" as const, title: `Published ${payload.release.tag_name}`, detail: payload.release.name ?? "New release", commitCount: 0 };
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !isDatabaseConfigured()) return Response.json({ error: "Webhook storage is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_WEBHOOK_BYTES) return Response.json({ error: "Payload is too large." }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) return Response.json({ error: "Payload is too large." }, { status: 413 });
  if (!verifyGitHubWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  const deliveryId = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");
  if (!deliveryId || !event) return Response.json({ error: "Required GitHub headers are missing." }, { status: 400 });

  let payload: GitHubWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as GitHubWebhookPayload;
  } catch {
    return Response.json({ error: "Webhook body is not valid JSON." }, { status: 400 });
  }
  if (event === "ping") return Response.json({ ok: true, pong: true });
  const installationId = payload.installation?.id;
  if (!installationId) return Response.json({ error: "Installation ID is missing." }, { status: 400 });

  const shouldProcess = await beginWebhookDelivery(deliveryId, event, payload.action);
  if (!shouldProcess) return Response.json({ ok: true, duplicate: true });
  try {
    await upsertInstallation({
      id: installationId,
      account: payload.installation?.account,
      repositorySelection: payload.installation?.repository_selection,
    });

    if (event === "installation" || event === "installation_repositories") {
      for (const repo of payload.repositories ?? payload.repositories_added ?? []) await upsertRepository(installationId, repo);
      for (const repo of payload.repositories_removed ?? []) await markRepositoryRemoved(repo.id, installationId);
    } else if (payload.repository) {
      if (event === "repository" && payload.action === "deleted") await markRepositoryRemoved(payload.repository.id, installationId);
      else await upsertRepository(installationId, payload.repository);
    }

    const activity = eventTitle(event, payload);
    if (activity) await recordActivity({
      id: `${deliveryId}:${event}`,
      repositoryId: payload.repository?.id,
      installationId,
      eventType: activity.type,
      action: payload.action,
      title: activity.title,
      detail: activity.detail,
      commitCount: activity.commitCount,
    });
    await finishWebhookDelivery(deliveryId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed.";
    await finishWebhookDelivery(deliveryId, message);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
