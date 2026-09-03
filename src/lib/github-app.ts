import "server-only";

import { createAppAuth } from "@octokit/auth-app";

function requireEnvironment(name: "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function isGitHubAppConfigured() {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

function createAuth() {
  return createAppAuth({
    appId: requireEnvironment("GITHUB_APP_ID"),
    privateKey: requireEnvironment("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
  });
}

export async function getInstallationToken(installationId: number) {
  const authentication = await createAuth()({ type: "installation", installationId });
  if (!("token" in authentication)) throw new Error("GitHub did not return an installation token.");
  return authentication.token;
}

export async function getAppToken() {
  const authentication = await createAuth()({ type: "app" });
  if (!("token" in authentication)) throw new Error("GitHub did not return an app token.");
  return authentication.token;
}

export function githubApiHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Repo-Pulse-GitHub-App",
  };
}
