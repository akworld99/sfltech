import { getEnv } from "@/lib/db";
import { insertLeads, parseSubmission } from "@/lib/leads";

/**
 * Optional real-time lead intake. Register a Webflow "form_submission" webhook that points at
 *   https://sfltech.ai/team/api/webhooks/webflow?k=<WEBFLOW_WEBHOOK_SECRET>
 * The page-load sync in the Sales module already covers the same data, so this only removes the delay.
 */
const enc = new TextEncoder();

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  const secret = getEnv().WEBFLOW_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const body = await req.text();
  const signature = req.headers.get("x-webflow-signature");
  const timestamp = req.headers.get("x-webflow-timestamp");
  const token = new URL(req.url).searchParams.get("k") ?? "";

  let ok = false;
  if (signature && timestamp) {
    const age = Math.abs(Date.now() - Number(timestamp));
    ok = age < 5 * 60_000 && safeEqual(signature, await hmacHex(secret, `${timestamp}:${body}`));
  }
  if (!ok) ok = !!token && safeEqual(token, secret);
  if (!ok) return new Response("Unauthorized", { status: 401 });

  let event: { triggerType?: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (event.triggerType !== "form_submission" || !event.payload) return new Response("Ignored", { status: 200 });

  const p = event.payload as { id?: string; name?: string; data?: Record<string, unknown>; submittedAt?: string };
  if (!p.id || !p.name || !p.data) return new Response("Ignored", { status: 200 });
  const lead = parseSubmission(p.id, p.name, p.data, p.submittedAt ?? new Date().toISOString());
  if (lead) await insertLeads([lead]);
  return new Response("OK", { status: 200 });
}
