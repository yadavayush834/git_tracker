import "server-only";

import { getAppToken, getInstallationToken, githubApiHeaders } from "@/lib/github-app";
import type { GitHubAccountPayload, GitHubRepositoryPayload } from "@/lib/github-types";
import {
  finishSyncRun,
  markUnseenRepositoriesRemoved,
  startSyncRun,
  upsertInstallation,
  upsertRepository,
} from "./repository-store";

type InstallationResponse = {
  id: number;
  account: GitHubAccountPayload;
  repository_selection: string;
};

type InstallationRepositoriesResponse = {
  total_count: number;
  repositories: GitHubRepositoryPayload[];
};

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: githubApiHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GitHub sync request failed with status ${response.status}.`);
  return response.json() as Promise<T>;
}

export async function syncGitHubInstallation(installationId: number, kind = "reconciliation") {
  const appToken = await getAppToken();
  const installation = await fetchJson<InstallationResponse>(`https://api.github.com/app/installations/${installationId}`, appToken);
  await upsertInstallation({
    id: installation.id,
    account: installation.account,
    repositorySelection: installation.repository_selection,
  });
  const runId = await startSyncRun(installationId, kind);
  let repositoryCount = 0;
  try {
    const installationToken = await getInstallationToken(installationId);
    const repositoryIds: number[] = [];
    for (let page = 1; page <= 100; page += 1) {
      const payload = await fetchJson<InstallationRepositoriesResponse>(
        `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
        installationToken,
      );
      for (const repository of payload.repositories) {
        await upsertRepository(installationId, repository);
        repositoryIds.push(repository.id);
      }
      repositoryCount += payload.repositories.length;
      if (repositoryCount >= payload.total_count || payload.repositories.length < 100) break;
    }
    await markUnseenRepositoriesRemoved(installationId, repositoryIds);
    await finishSyncRun(runId, repositoryCount);
    return { installationId, repositoriesSeen: repositoryCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown synchronization error.";
    await finishSyncRun(runId, repositoryCount, message);
    throw error;
  }
}
