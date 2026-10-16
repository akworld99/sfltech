import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canUseHr } from "@/lib/roles";
import { FIELD_DEFS, KIND_LABEL, REF_HELP, REF_LABEL, getListing, loadOptions } from "@/lib/listings";
import { fmtDate } from "@/lib/format";
import { all } from "@/lib/db";
import ListingForm from "../ListingForm";
import { closeListingAction } from "../actions";

export default async function EditListing({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireUser(canUseHr);
  const { id } = await params;
  const { ok, error } = await searchParams;
  const l = await getListing(Number(id));
  if (!l) notFound();

  const options = await loadOptions(l.kind);
  const history = await all<{ actor: string; action: string; created_at: string }>(
    "SELECT actor, action, created_at FROM audit_log WHERE target = ? ORDER BY id DESC LIMIT 15",
    `${l.kind}:${l.ref_code}`,
  );
  const initial = {
    ref_code: l.ref_code,
    title: l.title,
    description_text: l.description_text,
    clickup_link: l.clickup_link,
    ...(JSON.parse(l.fields_json) as Record<string, string>),
  };

  return (
    <>
      <div className="row between">
        <div>
          <h1>
            {l.ref_code} · {l.title}
          </h1>
          <p className="sub">
            {KIND_LABEL[l.kind]} · <span className={`badge ${l.status}`}>{l.status}</span> · updated {fmtDate(l.updated_at)} by {l.updated_by}
          </p>
        </div>
        {l.status === "published" && (
          <form action={closeListingAction}>
            <input type="hidden" name="id" value={l.id} />
            <button className="btn danger" type="submit">
              Close &amp; remove from site
            </button>
          </form>
        )}
      </div>

      {ok && (
        <div className="notice ok">
          {ok === "published" ? "Published. It is live on sfltech.ai." : ok === "closed" ? "Closed and removed from the live site." : "Saved."}
        </div>
      )}
      {error && <div className="notice error">{error}</div>}
      {l.status === "closed" && <div className="notice">This listing is closed. Publishing again will put it back on the site.</div>}

      <ListingForm
        kind={l.kind}
        id={l.id}
        status={l.status}
        defs={FIELD_DEFS[l.kind]}
        options={options}
        refLabel={REF_LABEL[l.kind]}
        refHelp={REF_HELP[l.kind]}
        initial={initial}
      />

      <h2 style={{ marginTop: 32 }}>History</h2>
      <ul className="timeline card">
        {history.map((h, i) => (
          <li key={i}>
            <strong>{h.action}</strong> · {h.actor} <span className="muted">· {fmtDate(h.created_at)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
