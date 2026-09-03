import { getStoredDashboard, isDatabaseConfigured } from "@/data/repository-store";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json({ configured: false }, { status: 503 });
  }
  try {
    const dashboard = await getStoredDashboard();
    if (!dashboard) return Response.json({ configured: true, ready: false }, { status: 404 });
    return Response.json(dashboard);
  } catch {
    return Response.json({ error: "The stored dashboard could not be loaded." }, { status: 500 });
  }
}
