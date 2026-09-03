import { auth, isAuthenticationConfigured } from "@/auth";
import { syncGitHubInstallation } from "@/data/github-sync";
import { isDatabaseConfigured } from "@/data/repository-store";
import { getAppToken, githubApiHeaders, isGitHubAppConfigured } from "@/lib/github-app";
import type { GitHubAccountPayload } from "@/lib/github-types";

type InstallationResponse = {
  id: number;
  account: GitHubAccountPayload;
};

export async function GET(request: Request) {
  const home = new URL("/", request.url);
  if (!isAuthenticationConfigured() || !isDatabaseConfigured() || !isGitHubAppConfigured()) {
    home.searchParams.set("error", "configuration");
    return Response.redirect(home);
  }
  const session = await auth();
  if (!session?.user?.login) {
    const signIn = new URL("/api/auth/signin", request.url);
    signIn.searchParams.set("callbackUrl", request.url);
    return Response.redirect(signIn);
  }
  const installationId = Number(new URL(request.url).searchParams.get("installation_id"));
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    home.searchParams.set("error", "installation");
    return Response.redirect(home);
  }

  try {
    const token = await getAppToken();
    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      headers: githubApiHeaders(token),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Installation could not be verified.");
    const installation = await response.json() as InstallationResponse;
    const allowedOwner = (process.env.OWNER_GITHUB_LOGIN ?? session.user.login).toLowerCase();
    if (installation.account.type !== "User" || installation.account.login.toLowerCase() !== allowedOwner) {
      home.searchParams.set("error", "owner");
      return Response.redirect(home);
    }
    await syncGitHubInstallation(installationId, "installation");
    home.searchParams.set("connected", "true");
    return Response.redirect(home);
  } catch {
    home.searchParams.set("error", "sync");
    return Response.redirect(home);
  }
}
