import { all, first, getDb, run } from "@/lib/db";
import { listFormSubmissions, type FormSubmission } from "@/lib/webflow";
import type { LeadStatus } from "@/lib/roles";

/** Webflow form display name -> lead source. Forms not listed here (newsletter, job applications) are ignored. */
const FORM_SOURCES: Record<string, string> = {
  "CVP Report Auto Email": "assessment_cvp",
  "AI Report Auto Email": "assessment_ai",
  "Partner With SFL Tech": "partner",
  "SFL Enquiry Form": "contact",
};

export type ParsedLead = {
  submissionId: string;
  source: string;
  formName: string;
  fullName: string | null;
  email: string | null;
  company: string | null;
  jobTitle: string | null;
  country: string | null;
  resultLevel: string | null;
  reportUrl: string | null;
  payload: Record<string, unknown>;
  submittedAt: string;
};

const str = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  return null;
};
const fileUrl = (v: unknown): string | null => {
  if (typeof v === "string" && v.startsWith("http")) return v;
  if (v && typeof v === "object" && typeof (v as { hostedUrl?: unknown }).hostedUrl === "string") {
    return (v as { hostedUrl: string }).hostedUrl;
  }
  return null;
};
const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" ") || null;

export function parseSubmission(
  id: string,
  formName: string,
  data: Record<string, unknown>,
  submittedAt: string,
): ParsedLead | null {
  const source = FORM_SOURCES[formName];
  if (!source) return null;
  const base = { submissionId: id, source, formName, payload: data, submittedAt };
  const empty = { fullName: null, email: null, company: null, jobTitle: null, country: null, resultLevel: null, reportUrl: null };

  if (source.startsWith("assessment")) {
    // The assessment form packs it as "Name (Company) - Result level"; split it back out.
    const raw = str(data["Name"]) ?? "";
    const m = raw.match(/^(.*?)\s*\((.*)\)\s*-\s*(.+)$/);
    return {
      ...base,
      ...empty,
      fullName: m ? m[1].trim() || null : raw || null,
      company: m ? m[2].trim() || null : null,
      resultLevel: m ? m[3].trim() || null : null,
      email: str(data["Email"]),
      reportUrl: fileUrl(data["File"]),
    };
  }
  if (source === "partner") {
    return {
      ...base,
      ...empty,
      fullName: join(str(data["First Name"]), str(data["Last Name"])),
      email: str(data["Business Email"]),
      jobTitle: str(data["Partner-Type"]),
      country: str(data["Country / Region"]),
    };
  }
  return {
    ...base,
    ...empty,
    fullName: join(str(data["First Name"]), str(data["Last Name"])),
    email: str(data["Business Email"]),
    company: str(data["Company Name"]),
    jobTitle: str(data["Job Title"]),
    country: str(data["Office Location"]),
  };
}

export async function insertLeads(leads: ParsedLead[]): Promise<number> {
  if (!leads.length) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO leads
       (webflow_submission_id, source, form_name, full_name, email, company, job_title, country,
        result_level, report_url, payload_json, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const results = await db.batch(
    leads.map((l) =>
      stmt.bind(
        l.submissionId,
        l.source,
        l.formName,
        l.fullName,
        l.email,
        l.company,
        l.jobTitle,
        l.country,
        l.resultLevel,
        l.reportUrl,
        JSON.stringify(l.payload),
        l.submittedAt,
      ),
    ),
  );
  return results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

const fromApi = (s: FormSubmission) => parseSubmission(s.id, s.displayName, s.formResponse ?? {}, s.dateSubmitted);

/** Pulls recent Webflow form submissions. Stops as soon as a whole page is already known. */
export async function syncLeads(maxPages = 5): Promise<number> {
  let added = 0;
  for (let page = 0; page < maxPages; page++) {
    const subs = await listFormSubmissions(page * 100, 100);
    if (!subs.length) break;
    const parsed = subs.map(fromApi).filter((l): l is ParsedLead => !!l);
    const inserted = await insertLeads(parsed);
    added += inserted;
    if (inserted === 0 || subs.length < 100) break;
  }
  await run(
    "INSERT INTO sync_state (key, value) VALUES ('leads_last_sync', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  return added;
}

/** Lazy sync used on page load: only hits Webflow if the last sync is older than `minutes`. */
export async function syncIfStale(minutes = 5) {
  const last = await first<{ value: string }>("SELECT value FROM sync_state WHERE key='leads_last_sync'");
  if (last) {
    const age = Date.now() - new Date(last.value.replace(" ", "T") + "Z").getTime();
    if (age < minutes * 60_000) return;
  }
  try {
    await syncLeads();
  } catch (e) {
    console.error("lead sync failed", e);
  }
}

export type Lead = {
  id: number;
  source: string;
  form_name: string;
  full_name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  country: string | null;
  result_level: string | null;
  report_url: string | null;
  payload_json: string;
  status: LeadStatus;
  assigned_to: string | null;
  submitted_at: string;
  updated_at: string;
};

export type LeadFilters = { status?: string; source?: string; assignee?: string; q?: string };

export function listLeads(scopeEmail: string | null, f: LeadFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (scopeEmail) {
    where.push("assigned_to = ?");
    params.push(scopeEmail);
  }
  if (f.status) {
    where.push("status = ?");
    params.push(f.status);
  }
  if (f.source) {
    where.push("source = ?");
    params.push(f.source);
  }
  if (f.assignee === "unassigned") where.push("assigned_to IS NULL");
  else if (f.assignee) {
    where.push("assigned_to = ?");
    params.push(f.assignee);
  }
  if (f.q) {
    where.push("(full_name LIKE ? OR email LIKE ? OR company LIKE ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like);
  }
  return all<Lead>(
    `SELECT * FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY submitted_at DESC LIMIT 300`,
    ...params,
  );
}

export const getLead = (id: number) => first<Lead>("SELECT * FROM leads WHERE id = ?", id);

export const leadEvents = (id: number) =>
  all<{ actor: string; kind: string; detail: string; created_at: string }>(
    "SELECT actor, kind, detail, created_at FROM lead_events WHERE lead_id = ? ORDER BY created_at DESC, id DESC",
    id,
  );

export const addEvent = (leadId: number, actor: string, kind: string, detail: string) =>
  run("INSERT INTO lead_events (lead_id, actor, kind, detail) VALUES (?, ?, ?, ?)", leadId, actor, kind, detail);

export const assignableUsers = () =>
  all<{ email: string; name: string | null; role: string }>(
    "SELECT email, name, role FROM users WHERE active = 1 AND role IN ('sales_rep','sales_manager') ORDER BY COALESCE(name, email)",
  );
