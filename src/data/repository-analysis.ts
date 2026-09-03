import "server-only";

import { getInstallationToken, githubApiHeaders } from "@/lib/github-app";
import type { RepositoryUnderstanding } from "@/lib/dashboard-data";
import { getRepositoriesForAnalysis, saveRepositoryUnderstanding } from "./repository-store";

type TreeEntry = { path: string; type: "blob" | "tree"; size?: number };
type TreeResponse = { tree: TreeEntry[]; truncated: boolean };
type ContentResponse = { content?: string; encoding?: string };
type AnalysisRepository = Awaited<ReturnType<typeof getRepositoriesForAnalysis>>[number];

const ANALYSIS_VERSION = 1;
const manifestNames = ["package.json", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml"];

async function githubJson<T>(url: string, token: string): Promise<T | null> {
  const response = await fetch(url, { headers: githubApiHeaders(token), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (response.status === 404 || response.status === 409) return null;
  if (!response.ok) throw new Error(`Repository analysis failed with status ${response.status}.`);
  return response.json() as Promise<T>;
}

async function readManifest(fullName: string, branch: string, path: string, token: string) {
  const payload = await githubJson<ContentResponse>(
    `https://api.github.com/repos/${fullName}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    token,
  );
  if (!payload?.content || payload.encoding !== "base64") return "";
  return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, 200_000);
}

function detectFramework(paths: string[], manifest: string) {
  const haystack = `${paths.join("\n")}\n${manifest}`.toLowerCase();
  if (haystack.includes("next.config") || /[\"']next[\"']\s*:/.test(haystack)) return "Next.js";
  if (haystack.includes("nuxt.config") || /[\"']nuxt[\"']\s*:/.test(haystack)) return "Nuxt";
  if (haystack.includes("svelte.config") || haystack.includes("@sveltejs")) return "SvelteKit";
  if (haystack.includes("vite.config") && haystack.includes("react")) return "React + Vite";
  if (haystack.includes("angular.json") || haystack.includes("@angular/core")) return "Angular";
  if (haystack.includes("expo") || haystack.includes("react-native")) return "React Native / Expo";
  if (haystack.includes("fastapi")) return "FastAPI";
  if (haystack.includes("django")) return "Django";
  if (haystack.includes("flask")) return "Flask";
  if (haystack.includes("express")) return "Express";
  if (haystack.includes("spring-boot") || haystack.includes("springframework")) return "Spring Boot";
  if (haystack.includes("cargo.toml")) return "Rust";
  if (haystack.includes("go.mod")) return "Go";
  return null;
}

function detectProjectKind(paths: string[], framework: string | null, manifest: string) {
  const haystack = `${paths.join("\n")}\n${manifest}`.toLowerCase();
  if (framework?.includes("React Native") || haystack.includes("android/") || haystack.includes("ios/")) return "Mobile app";
  if (framework && ["FastAPI", "Django", "Flask", "Express", "Spring Boot"].includes(framework)) return "API / service";
  if (framework && ["Next.js", "Nuxt", "SvelteKit", "React + Vite", "Angular"].includes(framework)) return "Web application";
  if (haystack.includes("notebook") || haystack.includes(".ipynb") || haystack.includes("pytorch") || haystack.includes("tensorflow")) return "Data / ML project";
  if (haystack.includes("bin/") || haystack.includes("commander") || haystack.includes("click")) return "CLI / developer tool";
  if (haystack.includes("package.json") || haystack.includes("pyproject.toml") || haystack.includes("cargo.toml") || haystack.includes("go.mod")) return "Software project";
  return paths.length ? "Code repository" : "Empty repository";
}

async function analyzeRepository(repo: AnalysisRepository, token: string): Promise<RepositoryUnderstanding> {
  const branch = repo.defaultBranch || "HEAD";
  const tree = await githubJson<TreeResponse>(
    `https://api.github.com/repos/${repo.fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  );
  const paths = (tree?.tree ?? []).filter((entry) => entry.type === "blob").map((entry) => entry.path);
  const lowerPaths = paths.map((path) => path.toLowerCase());
  const manifestPath = paths.find((path) => manifestNames.some((name) => path.toLowerCase() === name.toLowerCase()));
  const manifest = manifestPath ? await readManifest(repo.fullName, branch, manifestPath, token) : "";
  const hasReadme = lowerPaths.some((path) => /(^|\/)readme(\.|$)/.test(path));
  const hasTests = lowerPaths.some((path) => /(^|\/)(__tests__|tests?|spec)(\/|\.|$)/.test(path) || /\.(test|spec)\.[a-z]+$/.test(path));
  const hasCi = lowerPaths.some((path) => path.startsWith(".github/workflows/") || path === ".gitlab-ci.yml");
  const hasLicense = lowerPaths.some((path) => /(^|\/)licen[cs]e(\.|$)/.test(path));
  const hasDeploy = lowerPaths.some((path) => ["vercel.json", "netlify.toml", "render.yaml", "fly.toml", "dockerfile", "docker-compose.yml"].some((name) => path.endsWith(name)));
  const framework = detectFramework(lowerPaths, manifest);
  const projectKind = detectProjectKind(lowerPaths, framework, manifest);
  const daysSincePush = repo.pushedAt ? Math.floor((Date.now() - repo.pushedAt.getTime()) / 86_400_000) : 999;
  const healthScore = Math.min(100, (hasReadme ? 15 : 0) + (hasTests ? 20 : 0) + (hasCi ? 15 : 0) + (hasLicense ? 10 : 0) + (manifestPath ? 20 : 0) + (hasDeploy ? 10 : 0) + (daysSincePush <= 30 ? 10 : 0));
  const signals = [hasReadme && "README", hasTests && "Tests", hasCi && "CI", hasLicense && "License", hasDeploy && "Deployment", manifestPath && "Dependency manifest", tree?.truncated && "Large tree"].filter((signal): signal is string => Boolean(signal));
  const nextAction = paths.length === 0 ? "Add the first project files or archive this repository." : !hasReadme ? "Add a README that explains the project and how to run it." : !hasTests ? "Add a small automated test suite around the main workflow." : !hasCi ? "Add a CI workflow so every change is verified." : daysSincePush > 90 ? "Decide whether to resume, complete, or archive this inactive project." : "Define the next shippable milestone and link it to an issue.";
  const frameworkText = framework ? ` built with ${framework}` : "";
  const qualityText = signals.length ? ` It currently includes ${signals.slice(0, 4).join(", ")}.` : " It has limited project structure so far.";
  return {
    projectKind,
    framework,
    summary: `${projectKind}${frameworkText}.${qualityText}`,
    nextAction,
    healthScore,
    signals,
    fileCount: paths.length,
  };
}

export async function analyzePendingRepositories(limit = 5) {
  const candidates = await getRepositoriesForAnalysis(limit);
  const tokens = new Map<number, string>();
  const results: Array<{ repositoryId: number; ok: boolean }> = [];
  for (const repo of candidates) {
    try {
      let token = tokens.get(repo.installationId);
      if (!token) {
        token = await getInstallationToken(repo.installationId);
        tokens.set(repo.installationId, token);
      }
      const understanding = await analyzeRepository(repo, token);
      await saveRepositoryUnderstanding(repo.id, understanding);
      results.push({ repositoryId: repo.id, ok: true });
    } catch {
      results.push({ repositoryId: repo.id, ok: false });
    }
  }
  return { analysisVersion: ANALYSIS_VERSION, processed: results.length, succeeded: results.filter((result) => result.ok).length, results };
}
