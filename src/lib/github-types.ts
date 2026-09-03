export type GitHubRepositoryPayload = {
  id: number;
  name: string;
  full_name: string;
  description?: string | null;
  language?: string | null;
  visibility?: string;
  private?: boolean;
  html_url: string;
  default_branch?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  size?: number;
  topics?: string[];
  archived?: boolean;
  fork?: boolean;
  homepage?: string | null;
  pushed_at?: string | null;
  updated_at?: string | null;
};

export type GitHubAccountPayload = {
  id?: number;
  login: string;
  type?: string;
  avatar_url?: string;
  html_url?: string;
};

export type GitHubInstallationPayload = {
  id: number;
  account?: GitHubAccountPayload;
  repository_selection?: string;
};

export type GitHubWebhookPayload = {
  action?: string;
  installation?: GitHubInstallationPayload;
  repository?: GitHubRepositoryPayload;
  repositories?: GitHubRepositoryPayload[];
  repositories_added?: GitHubRepositoryPayload[];
  repositories_removed?: GitHubRepositoryPayload[];
  commits?: Array<{ id?: string; message?: string }>;
  head_commit?: { id?: string; message?: string } | null;
  pull_request?: { number: number; title: string; merged?: boolean };
  issue?: { number: number; title: string };
  release?: { tag_name: string; name?: string | null };
};
