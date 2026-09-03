import { Code2, GitBranch, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { signIn } from "@/auth";

export function SignInScreen() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand auth-brand"><div className="brand-mark"><GitBranch size={20} /></div><span>Repo<span>Pulse</span></span></div>
        <div className="auth-icon"><Code2 size={28} /></div>
        <p className="eyebrow">Your private project cockpit</p>
        <h1>Understand every project you’ve started.</h1>
        <p className="auth-intro">Sign in with GitHub to securely view your stored repository intelligence and installation.</p>
        <form action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}>
          <button type="submit"><Code2 size={18} />Continue with GitHub</button>
        </form>
        <div className="auth-points">
          <span><ShieldCheck size={15} />Read-only repository access</span>
          <span><LockKeyhole size={15} />Private data stays behind your login</span>
          <span><Sparkles size={15} />Automatic project understanding</span>
        </div>
      </section>
      <p className="auth-footnote">You choose all repositories or only selected ones during installation.</p>
    </main>
  );
}
