import { Dashboard } from "@/components/dashboard";
import { demoPayload } from "@/lib/dashboard-data";

export default function Home() {
  return <Dashboard initialData={demoPayload} />;
}
