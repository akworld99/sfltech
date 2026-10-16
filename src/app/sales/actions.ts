"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, first, run } from "@/lib/db";
import { requireUser, type PortalUser } from "@/lib/session";
import { canAssign, canSeeAllLeads, canUseSales, LEAD_STATUSES, type LeadStatus } from "@/lib/roles";
import { addEvent, getLead, syncLeads } from "@/lib/leads";

async function leadForUser(user: PortalUser, id: number) {
  const lead = await getLead(id);
  if (!lead) redirect("/sales");
  // Reps can only touch leads assigned to them.
  if (!canSeeAllLeads(user.role) && lead.assigned_to !== user.email) redirect("/sales?denied=1");
  return lead;
}

export async function syncAction() {
  const user = await requireUser(canUseSales);
  let msg: string;
  try {
    const n = await syncLeads();
    msg = `Synced. ${n} new lead${n === 1 ? "" : "s"}.`;
    await audit(user.email, "leads.sync", "webflow", String(n));
  } catch (e) {
    msg = `Sync failed: ${e instanceof Error ? e.message : "unknown error"}`;
  }
  revalidatePath("/sales");
  redirect(`/sales?msg=${encodeURIComponent(msg)}`);
}

export async function assignAction(formData: FormData) {
  const user = await requireUser((r) => canAssign(r));
  const id = Number(formData.get("id"));
  const to = String(formData.get("assignee") ?? "").toLowerCase();
  const lead = await leadForUser(user, id);

  if (!to) {
    await run("UPDATE leads SET assigned_to = NULL, status = CASE WHEN status='assigned' THEN 'new' ELSE status END, updated_at = datetime('now') WHERE id = ?", id);
    await addEvent(id, user.email, "assigned", "Unassigned");
  } else {
    const target = await first<{ email: string; name: string | null }>(
      "SELECT email, name FROM users WHERE email = ? AND active = 1 AND role IN ('sales_rep','sales_manager')",
      to,
    );
    if (!target) redirect(`/sales/${id}?error=${encodeURIComponent("That person cannot be assigned leads.")}`);
    await run(
      "UPDATE leads SET assigned_to = ?, status = CASE WHEN status='new' THEN 'assigned' ELSE status END, updated_at = datetime('now') WHERE id = ?",
      target.email,
      id,
    );
    await addEvent(id, user.email, "assigned", `Assigned to ${target.name ?? target.email}`);
    await audit(user.email, "lead.assign", `lead:${lead.id}`, target.email);
  }
  revalidatePath("/sales");
  redirect(`/sales/${id}?ok=1`);
}

export async function statusAction(formData: FormData) {
  const user = await requireUser(canUseSales);
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as LeadStatus;
  if (!LEAD_STATUSES.includes(status)) redirect(`/sales/${id}`);
  const lead = await leadForUser(user, id);
  if (lead.status !== status) {
    await run("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?", status, id);
    await addEvent(id, user.email, "status", `${lead.status} → ${status}`);
  }
  revalidatePath("/sales");
  redirect(`/sales/${id}?ok=1`);
}

export async function noteAction(formData: FormData) {
  const user = await requireUser(canUseSales);
  const id = Number(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  await leadForUser(user, id);
  if (note) {
    await addEvent(id, user.email, "note", note);
    await run("UPDATE leads SET updated_at = datetime('now') WHERE id = ?", id);
  }
  revalidatePath(`/sales/${id}`);
  redirect(`/sales/${id}?ok=1`);
}
