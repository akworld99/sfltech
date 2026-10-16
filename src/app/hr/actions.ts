"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { canUseHr } from "@/lib/roles";
import { close, FIELD_DEFS, getListing, publish, saveDraft, validateInput, type Kind, type ListingInput } from "@/lib/listings";

export type FormState = { error: string | null; values: Record<string, string> };

export async function saveListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(canUseHr);
  const kind = String(formData.get("kind")) as Kind;
  if (kind !== "vacancy" && kind !== "partner") return { error: "Unknown listing type.", values: {} };
  const id = Number(formData.get("id")) || undefined;
  const intent = String(formData.get("intent") ?? "save");

  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") values[k] = v;

  const input: ListingInput = {
    kind,
    ref_code: (values.ref_code ?? "").trim(),
    title: values.title ?? "",
    description_text: values.description_text ?? "",
    clickup_link: values.clickup_link ?? "",
    fields: Object.fromEntries(FIELD_DEFS[kind].map((d) => [d.name, (values[d.name] ?? "").trim()])),
  };

  const problem = validateInput(input);
  if (problem) return { error: problem, values };

  let savedId: number;
  try {
    savedId = await saveDraft(input, user.email, id);
  } catch (e) {
    const msg = e instanceof Error && /UNIQUE/i.test(e.message) ? `${input.ref_code.toUpperCase()} already exists.` : "Could not save the listing.";
    return { error: msg, values };
  }

  if (intent === "publish") {
    try {
      await publish(savedId, user.email);
    } catch (e) {
      return {
        error: `Saved as draft, but publishing failed: ${e instanceof Error ? e.message : "unknown error"}`,
        values,
      };
    }
  }
  revalidatePath("/hr");
  redirect(`/hr/${savedId}?ok=${intent === "publish" ? "published" : "saved"}`);
}

export async function closeListingAction(formData: FormData) {
  const user = await requireUser(canUseHr);
  const id = Number(formData.get("id"));
  const l = await getListing(id);
  if (!l) redirect("/hr");
  try {
    await close(id, user.email);
  } catch (e) {
    redirect(`/hr/${id}?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not close the listing.")}`);
  }
  revalidatePath("/hr");
  redirect(`/hr/${id}?ok=closed`);
}
