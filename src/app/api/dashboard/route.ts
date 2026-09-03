import { getStoredDashboard, isDatabaseConfigured } from "@/data/repository-store";
import { auth, isAuthenticationConfigured } from "@/auth";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json({ configured: false }, { status: 503 });
  }
  if (!isAuthenticationConfigured()) {
    return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.login) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const dashboard = await getStoredDashboard(session.user.login);
    if (!dashboard) return Response.json({ configured: true, ready: false }, { status: 404 });
    return Response.json(dashboard);
  } catch {
    return Response.json({ error: "The stored dashboard could not be loaded." }, { status: 500 });
  }
}
