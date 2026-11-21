import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { getDb } from "./lib/db";
import { upsertUser } from "./lib/services";

const providers: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
export const devLoginEnabled = process.env.DEV_LOGIN === "1";
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev sign-in",
      credentials: { name: { label: "Name" }, email: { label: "Email" } },
      async authorize(c) {
        const email = String(c?.email ?? "").trim();
        const name = String(c?.name ?? "").trim();
        if (!email.includes("@") || !name) return null;
        const u = await upsertUser(await getDb(), { email, name });
        return { id: u._id, name: u.name, email: u.email };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account) {
        if (account.provider === "dev") token.uid = user.id;
        else {
          const u = await upsertUser(await getDb(), { email: user.email!, name: user.name ?? user.email!, image: user.image });
          token.uid = u._id;
          token.name = u.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) (session.user as { id?: string }).id = String(token.uid);
      return session;
    },
  },
});
