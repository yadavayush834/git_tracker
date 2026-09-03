import { classifyRepository, type ActivityItem, type Repository } from "@/lib/dashboard-data";
import { auth, isAuthenticationConfigured } from "@/auth";

type GitHubRepo = {
  id: number; name: string; description: string | null; language: string | null;
  visibility: "public" | "private"; private: boolean; updated_at: string;
  pushed_at: string | null; html_url: string; stargazers_count: number;
  forks_count: number; open_issues_count: number; size: number; topics: string[];
  archived: boolean; fork: boolean; homepage: string | null;
};

type GitHubUser = { login: string; name: string | null; avatar_url: string; html_url: string };

type GitHubEvent = {
  id: string; type: string; repo: { name: string }; created_at: string;
  payload: {
    size?: number; action?: string;
    pull_request?: { number: number; title: string };
    issue?: { number: number; title: string };
    release?: { tag_name: string; name: string | null };
    commits?: { message: string }[];
  };
};

const usernamePattern = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function githubHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Repo-Pulse-Dashboard",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubFetch<T>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders(token), cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = body?.message ?? `GitHub returned ${response.status}`;
    throw new Error(response.status === 404 ? "GitHub user not found." : message);
  }
  return response.json() as Promise<T>;
}

function mapActivity(event: GitHubEvent): ActivityItem | null {
  const repo = event.repo.name.split("/").pop() ?? event.repo.name;
  if (event.type === "PushEvent") {
    const count = event.payload.size ?? event.payload.commits?.length ?? 1;
    return { id: event.id, type: "push", repo, title: `Pushed ${count} ${count === 1 ? "commit" : "commits"}`, detail: event.payload.commits?.[0]?.message ?? "Updated the repository", createdAt: event.created_at };
  }
  if (event.type === "PullRequestEvent" && event.payload.pull_request) {
    return { id: event.id, type: "pull_request", repo, title: `${event.payload.action === "closed" ? "Closed" : "Updated"} pull request #${event.payload.pull_request.number}`, detail: event.payload.pull_request.title, createdAt: event.created_at };
  }
  if (event.type === "IssuesEvent" && event.payload.issue) {
    return { id: event.id, type: "issue", repo, title: `${event.payload.action === "closed" ? "Closed" : "Updated"} issue #${event.payload.issue.number}`, detail: event.payload.issue.title, createdAt: event.created_at };
  }
  if (event.type === "ReleaseEvent" && event.payload.release) {
    return { id: event.id, type: "release", repo, title: `Published ${event.payload.release.tag_name}`, detail: event.payload.release.name ?? "New release", createdAt: event.created_at };
  }
  return null;
}

export async function GET(request: Request) {
  const requestedUsername = new URL(request.url).searchParams.get("username")?.trim();
  const configuredUsername = process.env.GITHUB_USERNAME?.trim();
  const token = process.env.GITHUB_TOKEN?.trim();
  const username = requestedUsername || configuredUsername;
  const apiToken = requestedUsername ? undefined : token;

  if (username && !usernamePattern.test(username)) {
    return Response.json({ error: "Enter a valid GitHub username." }, { status: 400 });
  }
  if (!username && !apiToken) {
    return Response.json({ error: "Enter a GitHub username or configure GITHUB_TOKEN." }, { status: 400 });
  }

  if (apiToken) {
    if (!isAuthenticationConfigured()) return Response.json({ error: "Authenticated private import is not configured." }, { status: 503 });
    const session = await auth();
    if (!session?.user?.login) return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const user = await githubFetch<GitHubUser>(username ? `https://api.github.com/users/${username}` : "https://api.github.com/user", apiToken);
    const usePrivateEndpoint = Boolean(apiToken && !requestedUsername && (!configuredUsername || configuredUsername === user.login));
    const repoEndpoint = usePrivateEndpoint
      ? "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner"
      : `https://api.github.com/users/${user.login}/repos?per_page=100&sort=pushed&type=owner`;
    const [githubRepos, events] = await Promise.all([
      githubFetch<GitHubRepo[]>(repoEndpoint, apiToken),
      githubFetch<GitHubEvent[]>(`https://api.github.com/users/${user.login}/events?per_page=100`, apiToken).catch(() => []),
    ]);

    const repositories: Repository[] = githubRepos.map((repo) => {
      const suggestion = classifyRepository(repo);
      return {
        id: repo.id, name: repo.name, description: repo.description || "No description added yet.",
        language: repo.language, visibility: repo.private ? "private" : repo.visibility,
        status: suggestion.status, progress: suggestion.progress, updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at, url: repo.html_url, stars: repo.stargazers_count,
        forks: repo.forks_count, openIssues: repo.open_issues_count, size: repo.size,
        topics: repo.topics, archived: repo.archived, isFork: repo.fork,
      };
    });
    const activities = events.map(mapActivity).filter((item): item is ActivityItem => item !== null);
    const contributions = Array.from({ length: 91 }, () => 0);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 90);
    for (const event of events) {
      const index = Math.floor((new Date(event.created_at).getTime() - start.getTime()) / 86_400_000);
      if (index >= 0 && index < contributions.length) contributions[index] += event.type === "PushEvent" ? event.payload.size ?? 1 : 1;
    }

    return Response.json({
      profile: { login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url, profileUrl: user.html_url },
      repositories, activities, contributions, syncedAt: new Date().toISOString(), source: "github",
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "GitHub sync failed." }, { status: 502 });
  }
}
