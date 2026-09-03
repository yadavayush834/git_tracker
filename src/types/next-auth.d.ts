import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { login: string };
  }

  interface User {
    login?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubLogin?: string;
  }
}
