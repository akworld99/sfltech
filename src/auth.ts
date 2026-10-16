import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { first, getEnv, run } from "@/lib/db";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/team";

const normalize = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * Sign-in gate. Entra ID is pinned to one tenant through the issuer URL, and on
 * top of that the email must exist (and be active) in the portal's users table.
 * The only exception is BOOTSTRAP_ADMIN_EMAILS, which seeds the first admin.
 */
async function isAllowed(email: string, name?: string | null): Promise<boolean> {
  if (!email) return false;
  const user = await first<{ active: number }>("SELECT active FROM users WHERE email = ?", email);
  if (user) {
    if (!user.active) return false;
    await run("UPDATE users SET last_login = datetime('now'), name = COALESCE(name, ?) WHERE email = ?", name ?? null, email);
    return true;
  }
  const bootstrap = (getEnv().BOOTSTRAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (bootstrap.includes(email)) {
    await run(
      "INSERT INTO users (email, name, role, active, last_login) VALUES (?, ?, 'admin', 1, datetime('now'))",
      email,
      name ?? null,
    );
    return true;
  }
  return false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  basePath: `${BASE_PATH}/api/auth`,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: `${BASE_PATH}/login`, error: `${BASE_PATH}/login` },
  callbacks: {
    async signIn({ profile }) {
      const email = normalize(profile?.email ?? (profile as Record<string, unknown> | undefined)?.preferred_username);
      return isAllowed(email, typeof profile?.name === "string" ? profile.name : null);
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.email = normalize(profile.email ?? (profile as Record<string, unknown>).preferred_username);
      }
      return token;
    },
  },
});
