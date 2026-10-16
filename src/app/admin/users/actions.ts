"use server";

import { revalidatePath } from "next/cache";
import { audit, run } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { Role } from "@/lib/roles";

const ROLES: Role[] = ["admin", "hr_editor", "sales_manager", "sales_rep"];

export async function saveUser(formData: FormData) {
  const me = await requireUser((r) => r === "admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "") as Role;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !ROLES.includes(role)) return;
  await run(
    `INSERT INTO users (email, name, role, region, active) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(email) DO UPDATE SET name = COALESCE(excluded.name, users.name), role = excluded.role, region = excluded.region, active = 1`,
    email,
    name,
    role,
    region,
  );
  await audit(me.email, "user.save", email, role);
  revalidatePath("/admin/users");
}

export async function setActive(formData: FormData) {
  const me = await requireUser((r) => r === "admin");
  const email = String(formData.get("email") ?? "").toLowerCase();
  const active = formData.get("active") === "1" ? 1 : 0;
  if (email === me.email) return; // never lock yourself out
  await run("UPDATE users SET active = ? WHERE email = ?", active, email);
  await audit(me.email, active ? "user.activate" : "user.deactivate", email);
  revalidatePath("/admin/users");
}
