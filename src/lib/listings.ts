import { audit, all, first, getEnv, run } from "@/lib/db";
import { textToHtml, slugify, validateClickupLink } from "@/lib/format";
import {
  createLiveItem,
  getCollection,
  optionId,
  optionNames,
  unpublishItem,
  updateAndPublishItem,
  type CollectionSchema,
} from "@/lib/webflow";

export type Kind = "vacancy" | "partner";

export type FieldDef = {
  name: string;
  label: string;
  /** Webflow field slug */
  slug: string;
  type: "text" | "option" | "date";
  required?: boolean;
  placeholder?: string;
  help?: string;
};

export const FIELD_DEFS: Record<Kind, FieldDef[]> = {
  vacancy: [
    { name: "department", label: "Department", slug: "department", type: "option", required: true },
    { name: "location", label: "Location", slug: "location", type: "text", required: true, placeholder: "Colombo, Sri Lanka" },
    { name: "type", label: "Type", slug: "type", type: "option", required: true },
    { name: "level", label: "Level", slug: "level", type: "text", placeholder: "Senior Level" },
    { name: "reportsTo", label: "Reports to", slug: "reports-to", type: "text" },
    { name: "employment", label: "Employment", slug: "employment", type: "text" },
    { name: "domain", label: "Domain", slug: "domain", type: "text" },
    { name: "certification", label: "Certification", slug: "certification", type: "text" },
    { name: "growthPath", label: "Growth path", slug: "growth-path", type: "text" },
    { name: "travel", label: "Travel", slug: "travel", type: "text", placeholder: "Not Required" },
  ],
  partner: [
    { name: "partnerType", label: "Partner type", slug: "partner-type", type: "option" },
    { name: "region", label: "Region", slug: "region", type: "text" },
    { name: "summary", label: "Summary", slug: "summary", type: "text", help: "One line shown on the listing card." },
  ],
};

export const KIND_LABEL: Record<Kind, string> = { vacancy: "Vacancy", partner: "Partner listing" };
export const REF_LABEL: Record<Kind, string> = { vacancy: "Job ID", partner: "Listing code" };
export const REF_HELP: Record<Kind, string> = {
  vacancy: "Region code + number, e.g. SL-001. Becomes the URL slug.",
  partner: "Short unique code, e.g. PT-001. Becomes the URL slug.",
};

export function collectionIdFor(kind: Kind): string | null {
  const env = getEnv();
  return (kind === "vacancy" ? env.WEBFLOW_VACANCIES_COLLECTION_ID : env.WEBFLOW_PARTNERS_COLLECTION_ID) || null;
}

export type Listing = {
  id: number;
  kind: Kind;
  ref_code: string;
  title: string;
  fields_json: string;
  description_text: string;
  clickup_link: string;
  status: "draft" | "published" | "closed";
  webflow_item_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export const getListing = (id: number) => first<Listing>("SELECT * FROM listings WHERE id = ?", id);
export const listListings = (kind: Kind) =>
  all<Listing>("SELECT * FROM listings WHERE kind = ? ORDER BY updated_at DESC", kind);

export type ListingInput = {
  kind: Kind;
  ref_code: string;
  title: string;
  fields: Record<string, string>;
  description_text: string;
  clickup_link: string;
};

export function validateInput(input: ListingInput): string | null {
  if (!/^[A-Za-z]{1,6}-\d{1,5}$/.test(input.ref_code)) {
    return `${REF_LABEL[input.kind]} must look like SL-001 (letters, dash, number).`;
  }
  if (!input.title.trim()) return "Title is required.";
  for (const def of FIELD_DEFS[input.kind]) {
    if (def.required && !input.fields[def.name]?.trim()) return `${def.label} is required.`;
  }
  const link = validateClickupLink(input.clickup_link);
  if (!link.ok) return link.error;
  return null;
}

/** Maps portal values to the Webflow CMS field data. Only fields that exist in the collection are sent. */
function buildFieldData(input: ListingInput, schema: CollectionSchema, createdAt: string) {
  const link = validateClickupLink(input.clickup_link);
  if (!link.ok) throw new Error(link.error);
  const present = new Set(schema.fields.map((f) => f.slug));
  const data: Record<string, unknown> = {
    name: input.title.trim(),
    slug: slugify(input.ref_code),
  };
  const put = (slug: string, value: unknown) => {
    if (present.has(slug) && value !== undefined && value !== "") data[slug] = value;
  };
  if (input.kind === "vacancy") put("job-id", input.ref_code.toUpperCase());
  else put("listing-code", input.ref_code.toUpperCase());
  for (const def of FIELD_DEFS[input.kind]) {
    const value = (input.fields[def.name] ?? "").trim();
    if (!value) continue;
    put(def.slug, def.type === "option" ? optionId(schema, def.slug, value) : value);
  }
  put("description", textToHtml(input.description_text));
  put("apply-link-email", link.url);
  put("date-posted", createdAt);
  return data;
}

export async function saveDraft(input: ListingInput, actor: string, id?: number): Promise<number> {
  const fieldsJson = JSON.stringify(input.fields);
  if (id) {
    await run(
      `UPDATE listings SET ref_code=?, title=?, fields_json=?, description_text=?, clickup_link=?,
         updated_by=?, updated_at=datetime('now') WHERE id=?`,
      input.ref_code.toUpperCase(),
      input.title.trim(),
      fieldsJson,
      input.description_text,
      input.clickup_link.trim(),
      actor,
      id,
    );
    await audit(actor, "listing.save", `${input.kind}:${input.ref_code}`);
    return id;
  }
  const res = await run(
    `INSERT INTO listings (kind, ref_code, title, fields_json, description_text, clickup_link, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.kind,
    input.ref_code.toUpperCase(),
    input.title.trim(),
    fieldsJson,
    input.description_text,
    input.clickup_link.trim(),
    actor,
    actor,
  );
  await audit(actor, "listing.create", `${input.kind}:${input.ref_code}`);
  return res.meta.last_row_id as number;
}

/** Publishes (or re-publishes) a saved listing to the live Webflow site. */
export async function publish(id: number, actor: string) {
  const l = await getListing(id);
  if (!l) throw new Error("Listing not found.");
  const collectionId = collectionIdFor(l.kind);
  if (!collectionId) throw new Error(`The Webflow collection for ${KIND_LABEL[l.kind].toLowerCase()}s is not configured yet.`);
  const schema = await getCollection(collectionId);
  const input: ListingInput = {
    kind: l.kind,
    ref_code: l.ref_code,
    title: l.title,
    fields: JSON.parse(l.fields_json),
    description_text: l.description_text,
    clickup_link: l.clickup_link,
  };
  const problem = validateInput(input);
  if (problem) throw new Error(problem);
  const fieldData = buildFieldData(input, schema, new Date(l.created_at.replace(" ", "T") + "Z").toISOString());

  let itemId = l.webflow_item_id;
  if (itemId) {
    await updateAndPublishItem(collectionId, itemId, fieldData);
  } else {
    itemId = (await createLiveItem(collectionId, fieldData)).id;
  }
  await run(
    "UPDATE listings SET status='published', webflow_item_id=?, updated_by=?, updated_at=datetime('now') WHERE id=?",
    itemId,
    actor,
    id,
  );
  await audit(actor, "listing.publish", `${l.kind}:${l.ref_code}`, itemId);
}

/** Takes a published listing off the live site. */
export async function close(id: number, actor: string) {
  const l = await getListing(id);
  if (!l) throw new Error("Listing not found.");
  const collectionId = collectionIdFor(l.kind);
  if (l.webflow_item_id && collectionId) await unpublishItem(collectionId, l.webflow_item_id);
  await run("UPDATE listings SET status='closed', updated_by=?, updated_at=datetime('now') WHERE id=?", actor, id);
  await audit(actor, "listing.close", `${l.kind}:${l.ref_code}`);
}

/** Dropdown choices for option fields, read from the live Webflow collection (empty if unavailable). */
export async function loadOptions(kind: Kind): Promise<Record<string, string[]>> {
  const id = collectionIdFor(kind);
  if (!id) return {};
  try {
    const schema = await getCollection(id);
    return Object.fromEntries(
      FIELD_DEFS[kind].filter((d) => d.type === "option").map((d) => [d.name, optionNames(schema, d.slug)]),
    );
  } catch {
    return {};
  }
}
