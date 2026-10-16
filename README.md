# SFL Tech Team Portal

One gated backend for sfltech.ai, served at `https://sfltech.ai/team` (Webflow Cloud, Next.js on Cloudflare).

| Module | Who | What |
|---|---|---|
| HR & Partners | `hr_editor`, `admin` | Create / edit / publish / close vacancies and partner listings, with the ClickUp form link. Writes to Webflow CMS and publishes, so the public Apply button points at the ClickUp form. |
| Sales | `sales_manager`, `sales_rep`, `admin` | Inbox of assessment (CVP, AI Readiness) and form submissions (Partner, Contact). Managers assign; reps see only their own leads and update status / notes. |
| Admin | `admin` | Add people and set roles at `/team/admin/users`. |

Login is Microsoft 365 SSO (single tenant). A person must also exist in the Users table (or be in `BOOTSTRAP_ADMIN_EMAILS`).
Leads live only in the portal database (D1). Nothing about leads is written to the public CMS.

## Setup

1. **Entra app registration** (Azure portal → App registrations → New)
   - Single tenant. Redirect URI (Web): `https://sfltech.ai/team/api/auth/callback/microsoft-entra-id`
   - Create a client secret. Note client ID, tenant ID, secret.
2. **Env vars** (Webflow Cloud environment settings; never commit them). See `.dev.vars.example`.
   - `AUTH_SECRET` (random 32+ bytes), `AUTH_URL=https://sfltech.ai/team/api/auth`
   - `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`
   - `AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0`
   - `WEBFLOW_API_TOKEN` (scopes: cms read/write, forms read, sites read)
   - `WEBFLOW_SITE_ID`, `WEBFLOW_VACANCIES_COLLECTION_ID`, optional `WEBFLOW_PARTNERS_COLLECTION_ID`
   - `BOOTSTRAP_ADMIN_EMAILS` (comma-separated SFL M365 addresses)
   - Optional `WEBFLOW_WEBHOOK_SECRET` for real-time lead intake: `https://sfltech.ai/team/api/webhooks/webflow?k=<secret>`
3. **Database**: `npx wrangler d1 migrations apply sfltech-team-portal --remote` (set the real `database_id` in `wrangler.json` first).
4. **Deploy**: Webflow Cloud builds from `main`. Locally: `npm run preview`.

## Local dev

```
cp .dev.vars.example .dev.vars   # fill in
npm install
npm run db:migrate:local
npm run dev
```

## Notes

- Keep the public `Assessment Leads` CMS collection empty and its template page in draft.
- Partner listings need a `Partner Opportunities` CMS collection; until `WEBFLOW_PARTNERS_COLLECTION_ID` is set, partner publishing is disabled.
- Assessment submissions currently pack score/company into the Name field; the parser handles `Name (Company) - Level`. Structured fields from the quiz would be better.
- Phase 2: ClickUp linking / iframing.
