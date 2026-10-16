import { getEnv } from "@/lib/db";

const API = "https://api.webflow.com/v2";

async function wf<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getEnv().WEBFLOW_API_TOKEN;
  if (!token) throw new Error("WEBFLOW_API_TOKEN is not configured.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "accept-version": "2.0.0",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Webflow API ${res.status} on ${init.method ?? "GET"} ${path}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type CollectionField = {
  slug: string;
  type: string;
  displayName: string;
  validations?: { options?: { id: string; name: string }[] };
};
export type CollectionSchema = { id: string; displayName: string; fields: CollectionField[] };

export const getCollection = (id: string) => wf<CollectionSchema>(`/collections/${id}`);

export const optionNames = (schema: CollectionSchema, slug: string) =>
  schema.fields.find((f) => f.slug === slug)?.validations?.options?.map((o) => o.name) ?? [];

export function optionId(schema: CollectionSchema, slug: string, name: string): string {
  const opt = schema.fields.find((f) => f.slug === slug)?.validations?.options?.find((o) => o.name === name);
  if (!opt) throw new Error(`"${name}" is not a valid ${slug} in the Webflow collection.`);
  return opt.id;
}

type Item = { id: string };

/** Creates a new item and publishes it to the live site in one call. */
export const createLiveItem = (collectionId: string, fieldData: Record<string, unknown>) =>
  wf<Item>(`/collections/${collectionId}/items/live`, {
    method: "POST",
    body: JSON.stringify({ isArchived: false, isDraft: false, fieldData }),
  });

/** Updates an existing item (staged) and publishes it. */
export async function updateAndPublishItem(collectionId: string, itemId: string, fieldData: Record<string, unknown>) {
  await wf(`/collections/${collectionId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ isArchived: false, isDraft: false, fieldData }),
  });
  await wf(`/collections/${collectionId}/items/publish`, {
    method: "POST",
    body: JSON.stringify({ itemIds: [itemId] }),
  });
}

/** Removes the item from the live site (keeps the staged copy). */
export const unpublishItem = (collectionId: string, itemId: string) =>
  wf(`/collections/${collectionId}/items/${itemId}/live`, { method: "DELETE" });

export type FormSubmission = {
  id: string;
  displayName: string;
  dateSubmitted: string;
  formResponse: Record<string, unknown>;
};

export async function listFormSubmissions(offset: number, limit = 100) {
  const siteId = getEnv().WEBFLOW_SITE_ID;
  if (!siteId) throw new Error("WEBFLOW_SITE_ID is not configured.");
  const res = await wf<{ formSubmissions: FormSubmission[] }>(
    `/sites/${siteId}/form_submissions?offset=${offset}&limit=${limit}`,
  );
  return res.formSubmissions ?? [];
}
