import { auth, isAuthenticationConfigured } from "@/auth";
import { isDatabaseConfigured, setManualRepositoryStatus } from "@/data/repository-store";
import type { RepositoryStatus } from "@/lib/dashboard-data";

const allowedStatuses = new Set<RepositoryStatus>(["In progress", "Started", "Stale", "Empty", "Completed", "Maintained"]);

export async function PATCH(request: Request, context: RouteContext<"/api/repositories/[id]/status">) {
  if (!isAuthenticationConfigured() || !isDatabaseConfigured()) {
    return Response.json({ error: "Persistent status storage is not configured." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.login) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const repositoryId = Number(id);
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) return Response.json({ error: "Invalid repository." }, { status: 400 });
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (!body || typeof body.status !== "string" || !allowedStatuses.has(body.status as RepositoryStatus)) {
    return Response.json({ error: "Invalid repository status." }, { status: 400 });
  }
  const updated = await setManualRepositoryStatus(repositoryId, session.user.login, body.status as RepositoryStatus);
  if (!updated) return Response.json({ error: "Repository not found." }, { status: 404 });
  return Response.json({ ok: true, status: body.status });
}
