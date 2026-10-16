import { requireUser } from "@/lib/session";
import { canUseHr } from "@/lib/roles";
import { FIELD_DEFS, KIND_LABEL, REF_HELP, REF_LABEL, loadOptions, type Kind } from "@/lib/listings";
import ListingForm from "../ListingForm";

export default async function NewListing({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireUser(canUseHr);
  const { kind: k } = await searchParams;
  const kind: Kind = k === "partner" ? "partner" : "vacancy";
  const options = await loadOptions(kind);
  return (
    <>
      <h1>New {KIND_LABEL[kind].toLowerCase()}</h1>
      <p className="sub">Fill in the details and paste the ClickUp form link applicants should use.</p>
      <ListingForm
        kind={kind}
        defs={FIELD_DEFS[kind]}
        options={options}
        refLabel={REF_LABEL[kind]}
        refHelp={REF_HELP[kind]}
        initial={{}}
      />
    </>
  );
}
