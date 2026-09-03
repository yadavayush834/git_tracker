import "server-only";

import { and, desc, eq, isNull, notInArray } from "drizzle-orm";
import { getDatabase, isDatabaseConfigured } from "@/db/client";
import { activityEvents, githubInstallations, repositories, syncRuns, webhookDeliveries } from "@/db/schema";
import { classifyRepository, type ActivityItem, type DashboardPayload, type RepositoryStatus } from "@/lib/dashboard-data";
import type { GitHubAccountPayload, GitHubRepositoryPayload } from "@/lib/github-types";

export { isDatabaseConfigured };

export async function upsertInstallation(input: {
  id: number;
  account?: GitHubAccountPayload;
  repositorySelection?: string;
}) {
  const db = getDatabase();
  const login = input.account?.login ?? process.env.GITHUB_USERNAME ?? "github-installation";
  await db.insert(githubInstallations).values({
    id: input.id,
    accountId: input.account?.id,
    accountLogin: login,
    accountType: input.account?.type ?? "User",
    avatarUrl: input.account?.avatar_url,
    profileUrl: input.account?.html_url,
    repositorySelection: input.repositorySelection ?? "all",
  }).onConflictDoUpdate({
    target: githubInstallations.id,
    set: {
      accountId: input.account?.id,
      accountLogin: login,
      accountType: input.account?.type ?? "User",
      avatarUrl: input.account?.avatar_url,
      profileUrl: input.account?.html_url,
      repositorySelection: input.repositorySelection ?? "all",
      updatedAt: new Date(),
    },
  });
}

export async function upsertRepository(installationId: number, repo: GitHubRepositoryPayload) {
  const db = getDatabase();
  const size = repo.size ?? 0;
  const openIssues = repo.open_issues_count ?? 0;
  const status = classifyRepository({
    size,
    archived: repo.archived ?? false,
    pushed_at: repo.pushed_at ?? null,
    open_issues_count: openIssues,
    homepage: repo.homepage,
  });
  const values = {
    id: repo.id,
    installationId,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    language: repo.language,
    visibility: repo.private ? "private" : repo.visibility ?? "public",
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    openIssues,
    size,
    topics: repo.topics ?? [],
    isArchived: repo.archived ?? false,
    isFork: repo.fork ?? false,
    detectedStatus: status.status,
    progress: status.progress,
    pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
    githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : null,
    removedAt: null,
    syncedAt: new Date(),
  };
  await db.insert(repositories).values(values).onConflictDoUpdate({
    target: repositories.id,
    set: values,
  });
}

export async function markRepositoryRemoved(repositoryId: number, installationId: number) {
  await getDatabase().update(repositories).set({ removedAt: new Date() }).where(and(eq(repositories.id, repositoryId), eq(repositories.installationId, installationId)));
}

export async function markUnseenRepositoriesRemoved(installationId: number, repositoryIds: number[]) {
  const condition = repositoryIds.length
    ? and(eq(repositories.installationId, installationId), notInArray(repositories.id, repositoryIds), isNull(repositories.removedAt))
    : and(eq(repositories.installationId, installationId), isNull(repositories.removedAt));
  await getDatabase().update(repositories).set({ removedAt: new Date() }).where(condition);
}

export async function recordActivity(input: {
  id: string;
  repositoryId?: number;
  installationId?: number;
  eventType: ActivityItem["type"];
  action?: string;
  title: string;
  detail?: string;
  commitCount?: number;
  occurredAt?: Date;
}) {
  await getDatabase().insert(activityEvents).values({
    ...input,
    occurredAt: input.occurredAt ?? new Date(),
  }).onConflictDoNothing({ target: activityEvents.id });
}

export async function beginWebhookDelivery(id: string, event: string, action?: string) {
  const db = getDatabase();
  const [existing] = await db.select({ status: webhookDeliveries.status }).from(webhookDeliveries).where(eq(webhookDeliveries.id, id)).limit(1);
  if (existing?.status === "completed") return false;
  await db.insert(webhookDeliveries).values({ id, event, action }).onConflictDoUpdate({
    target: webhookDeliveries.id,
    set: { status: "running", error: null, receivedAt: new Date() },
  });
  return true;
}

export async function finishWebhookDelivery(id: string, error?: string) {
  await getDatabase().update(webhookDeliveries).set({
    status: error ? "failed" : "completed",
    error,
    processedAt: new Date(),
  }).where(eq(webhookDeliveries.id, id));
}

export async function startSyncRun(installationId: number, kind: string) {
  const [run] = await getDatabase().insert(syncRuns).values({ installationId, kind }).returning({ id: syncRuns.id });
  return run.id;
}

export async function finishSyncRun(id: number, repositoriesSeen: number, error?: string) {
  await getDatabase().update(syncRuns).set({
    status: error ? "failed" : "completed",
    repositoriesSeen,
    error,
    finishedAt: new Date(),
  }).where(eq(syncRuns.id, id));
}

export async function getStoredDashboard(): Promise<DashboardPayload | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [installation] = await db.select().from(githubInstallations).orderBy(desc(githubInstallations.updatedAt)).limit(1);
  if (!installation) return null;
  const [repoRows, eventRows] = await Promise.all([
    db.select().from(repositories).where(and(eq(repositories.installationId, installation.id), isNull(repositories.removedAt))).orderBy(desc(repositories.pushedAt)),
    db.select().from(activityEvents).where(eq(activityEvents.installationId, installation.id)).orderBy(desc(activityEvents.occurredAt)).limit(100),
  ]);
  const contributions = Array.from({ length: 91 }, () => 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 90);
  for (const event of eventRows) {
    const index = Math.floor((event.occurredAt.getTime() - start.getTime()) / 86_400_000);
    if (index >= 0 && index < contributions.length) contributions[index] += Math.max(event.commitCount, 1);
  }
  return {
    profile: {
      login: installation.accountLogin,
      name: installation.accountLogin,
      avatarUrl: installation.avatarUrl ?? "",
      profileUrl: installation.profileUrl ?? `https://github.com/${installation.accountLogin}`,
    },
    repositories: repoRows.map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description ?? "No description added yet.",
      language: repo.language,
      visibility: repo.visibility === "private" ? "private" : "public",
      status: (repo.manualStatus ?? repo.detectedStatus) as RepositoryStatus,
      progress: repo.manualStatus === "Completed" || repo.manualStatus === "Maintained" ? 100 : repo.progress,
      updatedAt: (repo.githubUpdatedAt ?? repo.syncedAt).toISOString(),
      pushedAt: repo.pushedAt?.toISOString() ?? null,
      url: repo.htmlUrl,
      stars: repo.stars,
      forks: repo.forks,
      openIssues: repo.openIssues,
      size: repo.size,
      topics: repo.topics,
      archived: repo.isArchived,
      isFork: repo.isFork,
    })),
    activities: eventRows.map((event) => ({
      id: event.id,
      type: event.eventType as ActivityItem["type"],
      repo: repoRows.find((repo) => repo.id === event.repositoryId)?.name ?? "GitHub",
      title: event.title,
      detail: event.detail ?? "",
      createdAt: event.occurredAt.toISOString(),
    })),
    contributions,
    syncedAt: installation.updatedAt.toISOString(),
    source: "github",
  };
}
