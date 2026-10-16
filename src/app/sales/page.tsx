import { requireUser } from "@/lib/session";
import { canSeeAllLeads, canUseSales, LEAD_STATUSES, SOURCE_LABELS } from "@/lib/roles";
import { assignableUsers, listLeads, syncIfStale } from "@/lib/leads";
import { fmtDate } from "@/lib/format";
import { BASE_PATH } from "@/auth";
import { syncAction } from "./actions";

type SP = { status?: string; source?: string; assignee?: string; q?: string; msg?: string; denied?: string };

export default async function SalesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser(canUseSales);
  const sp = await searchParams;
  const all = canSeeAllLeads(user.role);

  await syncIfStale(5);
  const [leads, people] = await Promise.all([
    listLeads(all ? null : user.email, { status: sp.status, source: sp.source, assignee: sp.assignee, q: sp.q }),
    all ? assignableUsers() : Promise.resolve([]),
  ]);
  const nameOf = new Map(people.map((p) => [p.email, p.name ?? p.email]));

  return (
    <>
      <div className="row between">
        <div>
          <h1>{all ? "Leads" : "My leads"}</h1>
          <p className="sub">
            {all
              ? "Everyone who submitted an assessment or enquiry form on sfltech.ai."
              : "Leads assigned to you. Update the status as you work them."}
          </p>
        </div>
        <form action={syncAction}>
          <button className="btn" type="submit">
            Sync from website
          </button>
        </form>
      </div>

      {sp.msg && <div className="notice ok">{sp.msg}</div>}
      {sp.denied && <div className="notice error">You can only open leads assigned to you.</div>}

      <form className="filters" method="get">
        <div>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="text" defaultValue={sp.q ?? ""} placeholder="Name, email, company" />
        </div>
        <div>
          <label htmlFor="source">Source</label>
          <select id="source" name="source" defaultValue={sp.source ?? ""}>
            <option value="">All</option>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""}>
            <option value="">All</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {all && (
          <div>
            <label htmlFor="assignee">Assigned to</label>
            <select id="assignee" name="assignee" defaultValue={sp.assignee ?? ""}>
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {people.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name ?? p.email}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="btn primary" type="submit">
          Filter
        </button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Source</th>
            <th>Result</th>
            <th>Status</th>
            {all && <th>Assigned to</th>}
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr>
              <td colSpan={all ? 6 : 5} className="muted">
                No leads match.
              </td>
            </tr>
          )}
          {leads.map((l) => (
            <tr key={l.id}>
              <td>
                <a href={`${BASE_PATH}/sales/${l.id}`}>{l.full_name ?? l.email ?? "Unknown"}</a>
                <div className="muted">{[l.company, l.email].filter(Boolean).join(" · ")}</div>
              </td>
              <td>{SOURCE_LABELS[l.source] ?? l.source}</td>
              <td>{l.result_level ?? ""}</td>
              <td>
                <span className={`badge ${l.status}`}>{l.status}</span>
              </td>
              {all && <td>{l.assigned_to ? (nameOf.get(l.assigned_to) ?? l.assigned_to) : <span className="muted">—</span>}</td>}
              <td>{fmtDate(l.submitted_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length === 300 && <p className="muted">Showing the latest 300. Narrow the filters to see more.</p>}
    </>
  );
}
