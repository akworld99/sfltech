import { requireUser } from "@/lib/session";
import { first } from "@/lib/db";
import { canSeeAllLeads, canUseHr, canUseSales } from "@/lib/roles";
import { BASE_PATH } from "@/auth";

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const live = canUseHr(user.role)
    ? await first<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE status='published'")
    : null;
  const unassigned = canSeeAllLeads(user.role)
    ? await first<{ n: number }>("SELECT COUNT(*) n FROM leads WHERE assigned_to IS NULL")
    : null;
  const mine = canUseSales(user.role)
    ? await first<{ n: number }>(
        "SELECT COUNT(*) n FROM leads WHERE assigned_to = ? AND status IN ('assigned','contacted')",
        user.email,
      )
    : null;

  return (
    <>
      <h1>Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
      <p className="sub">Pick a module to get started.</p>
      {denied && <div className="notice error">You do not have access to that area.</div>}
      <div className="grid cols-3">
        {canUseHr(user.role) && (
          <a className="card" href={`${BASE_PATH}/hr`}>
            <h2>HR &amp; Partners</h2>
            <div className="stat">{live?.n ?? 0}</div>
            <div className="muted">listings live on sfltech.ai</div>
          </a>
        )}
        {canUseSales(user.role) && (
          <a className="card" href={`${BASE_PATH}/sales`}>
            <h2>Sales leads</h2>
            <div className="stat">{canSeeAllLeads(user.role) ? (unassigned?.n ?? 0) : (mine?.n ?? 0)}</div>
            <div className="muted">{canSeeAllLeads(user.role) ? "leads waiting to be assigned" : "of your leads need action"}</div>
          </a>
        )}
        {user.role === "admin" && (
          <a className="card" href={`${BASE_PATH}/admin/users`}>
            <h2>Users &amp; roles</h2>
            <div className="muted">Add people, set roles, deactivate access.</div>
          </a>
        )}
      </div>
    </>
  );
}
