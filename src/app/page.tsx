import { Dashboard } from "@/components/dashboard";
import { SignInScreen } from "@/components/sign-in-screen";
import { demoPayload } from "@/lib/dashboard-data";
import { auth, isAuthenticationConfigured } from "@/auth";

export default async function Home() {
  const authenticationEnabled = isAuthenticationConfigured();
  const session = authenticationEnabled ? await auth() : null;
  if (authenticationEnabled && !session) return <SignInScreen />;
  return (
    <Dashboard
      initialData={demoPayload}
      authenticated={Boolean(session)}
      githubAppSlug={process.env.GITHUB_APP_SLUG}
    />
  );
}
