import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { first } from "@/lib/db";
import type { Role } from "@/lib/roles";

export type PortalUser = { email: string; name: string | null; role: Role; region: string | null };

/** Current user from the database (role changes and deactivation apply immediately), or null. */
export async function getUser(): Promise<PortalUser | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const row = await first<PortalUser & { active: number }>(
    "SELECT email, name, role, region, active FROM users WHERE email = ?",
    email,
  );
  if (!row || !row.active) return null;
  return { email: row.email, name: row.name, role: row.role, region: row.region };
}

export async function requireUser(allowed?: (role: Role) => boolean): Promise<PortalUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (allowed && !allowed(user.role)) redirect("/?denied=1");
  return user;
}
