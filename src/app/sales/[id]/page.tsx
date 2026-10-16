import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canAssign, canSeeAllLeads, canUseSales, LEAD_STATUSES, SOURCE_LABELS } from "@/lib/roles";
import { assignableUsers, getLead, leadEvents } from "@/lib/leads";
import { fmtDate } from "@/lib/format";
import { assignAction, noteAction, statusAction } from "../actions";

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser(canUseSales);
  const { id } = await params;
  const sp = await searchParams;
  const lead = await getLead(Number(id));
  if (!lead) notFound();
  if (!canSeeAllLeads(user.role) && lead.assigned_to !== user.email) redirect("/sales?denied=1");

  const [events, people] = await Promise.all([leadEvents(lead.id), canAssign(user.role) ? assignableUsers() : Promise.resolve([])]);
  const payload = JSON.parse(lead.payload_json) as Record<string, unknown>;
  const show = (v: unknown) =>
    typeof v === "string" ? v : v && typeof v === "object" && "hostedUrl" in v ? String((v as { hostedUrl: string }).hostedUrl) : JSON.stringify(v);

  return (
    <>
      <p>
        <a href="../sales">← Back to leads</a>
      </p>
      <div className="row between">
        <div>
          <h1>{lead.full_name ?? lead.email ?? "Unknown lead"}</h1>
          <p className="sub">
            {SOURCE_LABELS[lead.source] ?? lead.source} · submitted {fmtDate(lead.submitted_at)}
          </p>
        </div>
        <span className={`badge ${lead.status}`}>{lead.status}</span>
      </div>

      {sp.ok && <div className="notice ok">Saved.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}

      <div className="grid cols-2">
        <section className="card">
          <h2>Contact</h2>
          <dl className="kv">
            <dt>Email</dt>
            <dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "—"}</dd>
            <dt>Company</dt>
            <dd>{lead.company ?? "—"}</dd>
            <dt>Role / type</dt>
            <dd>{lead.job_title ?? "—"}</dd>
            <dt>Country</dt>
            <dd>{lead.country ?? "—"}</dd>
            {lead.result_level && (
              <>
                <dt>Assessment result</dt>
                <dd>{lead.result_level}</dd>
              </>
            )}
            {lead.report_url && (
              <>
                <dt>Report sent</dt>
                <dd>
                  <a href={lead.report_url} target="_blank" rel="noopener noreferrer">
                    Open PDF
                  </a>
                </dd>
              </>
            )}
          </dl>
        </section>

        <section className="card">
          <h2>Work this lead</h2>
          {canAssign(user.role) && (
            <form action={assignAction} className="row" style={{ marginBottom: 16 }}>
              <input type="hidden" name="id" value={lead.id} />
              <div style={{ flex: 1 }}>
                <label htmlFor="assignee">Assigned to</label>
                <select id="assignee" name="assignee" defaultValue={lead.assigned_to ?? ""}>
                  <option value="">Unassigned</option>
                  {people.map((p) => (
                    <option key={p.email} value={p.email}>
                      {p.name ?? p.email}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn primary" type="submit" style={{ alignSelf: "end" }}>
                Assign
              </button>
            </form>
          )}
          <form action={statusAction} className="row">
            <input type="hidden" name="id" value={lead.id} />
            <div style={{ flex: 1 }}>
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={lead.status}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" type="submit" style={{ alignSelf: "end" }}>
              Update
            </button>
          </form>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Notes &amp; activity</h2>
        <form action={noteAction} style={{ marginBottom: 12 }}>
          <input type="hidden" name="id" value={lead.id} />
          <textarea className="short" name="note" placeholder="Add a note (call outcome, next step…)" maxLength={2000} />
          <div style={{ marginTop: 8 }}>
            <button className="btn" type="submit">
              Add note
            </button>
          </div>
        </form>
        <ul className="timeline">
          {events.length === 0 && <li className="muted">No activity yet.</li>}
          {events.map((e, i) => (
            <li key={i}>
              <strong>{e.kind}</strong> · {e.actor} <span className="muted">· {fmtDate(e.created_at)}</span>
              <div style={{ whiteSpace: "pre-wrap" }}>{e.detail}</div>
            </li>
          ))}
        </ul>
      </section>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>Everything the person submitted</summary>
        <dl className="kv" style={{ marginTop: 12 }}>
          {Object.entries(payload).map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{show(v)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
