export type RepositoryStatus =
  | "In progress"
  | "Started"
  | "Stale"
  | "Empty"
  | "Completed"
  | "Maintained";

export type RepositoryUnderstanding = {
  projectKind: string;
  framework: string | null;
  summary: string;
  nextAction: string;
  healthScore: number;
  signals: string[];
  fileCount: number;
};

export type Repository = {
  id: number;
  name: string;
  description: string;
  language: string | null;
  visibility: "public" | "private";
  status: RepositoryStatus;
  progress: number;
  updatedAt: string;
  pushedAt: string | null;
  url: string;
  stars: number;
  forks: number;
  openIssues: number;
  size: number;
  topics: string[];
  archived: boolean;
  isFork: boolean;
  understanding?: RepositoryUnderstanding | null;
};

export type ActivityItem = {
  id: string;
  type: "push" | "pull_request" | "issue" | "release";
  repo: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type DashboardPayload = {
  profile: { login: string; name: string; avatarUrl: string; profileUrl: string };
  repositories: Repository[];
  activities: ActivityItem[];
  contributions: number[];
  syncedAt: string;
  source: "github" | "demo";
};

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

export const demoPayload: DashboardPayload = {
  profile: { login: "your-github", name: "Your workspace", avatarUrl: "", profileUrl: "https://github.com" },
  repositories: [
    { id: 1, name: "pulse-dashboard", description: "A focused analytics dashboard for tracking product health.", language: "TypeScript", visibility: "private", status: "In progress", progress: 72, updatedAt: daysAgo(0), pushedAt: daysAgo(0), url: "https://github.com", stars: 0, forks: 0, openIssues: 4, size: 1384, topics: ["nextjs", "analytics"], archived: false, isFork: false, understanding: { projectKind: "Web application", framework: "Next.js", summary: "Web application built with Next.js. It currently includes README, Tests, CI, and Deployment.", nextAction: "Define the next shippable milestone and link it to an issue.", healthScore: 90, signals: ["README", "Tests", "CI", "Deployment"], fileCount: 146 } },
    { id: 2, name: "finflow-api", description: "Personal finance API and automatic transaction categorizer.", language: "Python", visibility: "private", status: "In progress", progress: 48, updatedAt: daysAgo(2), pushedAt: daysAgo(2), url: "https://github.com", stars: 0, forks: 0, openIssues: 7, size: 842, topics: ["fastapi", "finance"], archived: false, isFork: false },
    { id: 3, name: "portfolio-v3", description: "The third iteration of my personal portfolio and writing space.", language: "TypeScript", visibility: "public", status: "Maintained", progress: 100, updatedAt: daysAgo(7), pushedAt: daysAgo(7), url: "https://github.com", stars: 12, forks: 2, openIssues: 1, size: 563, topics: ["portfolio", "design"], archived: false, isFork: false, understanding: { projectKind: "Web application", framework: "Next.js", summary: "Web application built with Next.js. It currently includes README and Deployment.", nextAction: "Add a small automated test suite around the main workflow.", healthScore: 60, signals: ["README", "Deployment"], fileCount: 78 } },
    { id: 4, name: "local-ai-notes", description: "Experiments with local models and a searchable notes interface.", language: "Python", visibility: "public", status: "Started", progress: 24, updatedAt: daysAgo(18), pushedAt: daysAgo(18), url: "https://github.com", stars: 3, forks: 0, openIssues: 0, size: 230, topics: ["ai", "notes"], archived: false, isFork: false },
    { id: 5, name: "habit-mobile", description: "A tiny habit tracker for experiments with React Native.", language: "JavaScript", visibility: "private", status: "Stale", progress: 36, updatedAt: daysAgo(126), pushedAt: daysAgo(126), url: "https://github.com", stars: 0, forks: 0, openIssues: 2, size: 441, topics: ["mobile"], archived: false, isFork: false },
    { id: 6, name: "weather-cli", description: "Minimal terminal weather client with saved locations.", language: "Go", visibility: "public", status: "Completed", progress: 100, updatedAt: daysAgo(63), pushedAt: daysAgo(63), url: "https://github.com", stars: 8, forks: 1, openIssues: 0, size: 186, topics: ["cli"], archived: true, isFork: false },
    { id: 7, name: "untitled-experiment", description: "No description added yet.", language: null, visibility: "private", status: "Empty", progress: 0, updatedAt: daysAgo(41), pushedAt: null, url: "https://github.com", stars: 0, forks: 0, openIssues: 0, size: 0, topics: [], archived: false, isFork: false },
  ],
  activities: [
    { id: "a1", type: "push", repo: "pulse-dashboard", title: "Pushed 3 commits", detail: "Refined overview charts and repository filters", createdAt: new Date(now - 42 * 60_000).toISOString() },
    { id: "a2", type: "pull_request", repo: "finflow-api", title: "Merged pull request #18", detail: "Add recurring transaction detection", createdAt: new Date(now - 4.5 * 3_600_000).toISOString() },
    { id: "a3", type: "issue", repo: "portfolio-v3", title: "Closed issue #12", detail: "Improve article typography on mobile", createdAt: daysAgo(1) },
    { id: "a4", type: "release", repo: "weather-cli", title: "Published v1.0.0", detail: "First stable release", createdAt: daysAgo(3) },
  ],
  contributions: [0,1,0,2,3,0,1,0,0,2,1,4,0,0,1,3,2,0,5,2,1,0,0,3,4,1,0,2,3,1,1,0,4,6,3,2,0,1,3,5,2,1,0,2,4,2,3,1,0,2,5,4,3,1,0,1,3,2,4,6,2,1,0,3,5,2,4,1,2,7,4,3,1,0,2,4,3,6,2,1,0,2,5,3,4,2,1,3,7,5,3,4],
  syncedAt: new Date(now).toISOString(),
  source: "demo",
};

export function classifyRepository(repo: { size: number; archived: boolean; pushed_at: string | null; open_issues_count: number; homepage?: string | null }): { status: RepositoryStatus; progress: number } {
  if (repo.size === 0) return { status: "Empty", progress: 0 };
  if (repo.archived) return { status: "Completed", progress: 100 };
  const daysSincePush = repo.pushed_at ? Math.floor((Date.now() - new Date(repo.pushed_at).getTime()) / 86_400_000) : 999;
  const sizeScore = Math.min(38, Math.round(Math.log10(repo.size + 1) * 13));
  const activityScore = daysSincePush <= 7 ? 35 : daysSincePush <= 30 ? 24 : 10;
  const structureScore = repo.homepage ? 15 : 5;
  const issueScore = repo.open_issues_count > 0 ? 8 : 4;
  const progress = Math.min(92, sizeScore + activityScore + structureScore + issueScore);
  if (daysSincePush > 90) return { status: "Stale", progress };
  if (daysSincePush <= 30 && repo.size > 50) return { status: "In progress", progress };
  return { status: "Started", progress };
}
