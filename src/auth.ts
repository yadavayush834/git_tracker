import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export function isAuthenticationConfigured() {
  return Boolean(
    process.env.AUTH_SECRET &&
    process.env.GITHUB_APP_CLIENT_ID &&
    process.env.GITHUB_APP_CLIENT_SECRET,
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_APP_CLIENT_ID,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          login: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const owner = process.env.OWNER_GITHUB_LOGIN?.trim().toLowerCase();
      const login = typeof profile?.login === "string" ? profile.login.toLowerCase() : "";
      return !owner || login === owner;
    },
    jwt({ token, profile }) {
      if (typeof profile?.login === "string") token.githubLogin = profile.login;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.githubLogin === "string") session.user.login = token.githubLogin;
      return session;
    },
  },
});
