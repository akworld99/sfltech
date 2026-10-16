import { requireUser } from "@/lib/session";
import { canUseHr } from "@/lib/roles";
import { collectionIdFor, KIND_LABEL, listListings, type Kind } from "@/lib/listings";
import { fmtDate } from "@/lib/format";
import { BASE_PATH } from "@/auth";

export default async function HrPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireUser(canUseHr);
  const { kind: k } = await searchParams;
  const kind: Kind = k === "partner" ? "partner" : "vacancy";
  const rows = await listListings(kind);
  const configured = !!collectionIdFor(kind);

  return (
    <>
      <div className="row between">
        <div>
          <h1>HR &amp; Partners</h1>
          <p className="sub">Create listings here. Published listings appear on sfltech.ai automatically.</p>
        </div>
        <a className="btn primary" href={`${BASE_PATH}/hr/new?kind=${kind}`}>
          New {KIND_LABEL[kind].toLowerCase()}
        </a>
      </div>

      <div className="tabs">
        <a className={kind === "vacancy" ? "on" : ""} href={`${BASE_PATH}/hr?kind=vacancy`}>
          Vacancies
        </a>
        <a className={kind === "partner" ? "on" : ""} href={`${BASE_PATH}/hr?kind=partner`}>
          Partner listings
        </a>
      </div>

      {!configured && (
        <div className="notice error">
          The Webflow collection for {KIND_LABEL[kind].toLowerCase()}s is not configured yet. You can save drafts, but publishing is disabled until it is set up.
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Status</th>
            <th>Updated</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Nothing here yet.
              </td>
            </tr>
          )}
          {rows.map((l) => (
            <tr key={l.id}>
              <td>
                <a href={`${BASE_PATH}/hr/${l.id}`}>{l.ref_code}</a>
              </td>
              <td>{l.title}</td>
              <td>
                <span className={`badge ${l.status}`}>{l.status}</span>
              </td>
              <td>{fmtDate(l.updated_at)}</td>
              <td className="muted">{l.updated_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
