interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;

  // Auth.js + Microsoft Entra ID (single tenant)
  AUTH_SECRET: string;
  AUTH_URL: string;
  AUTH_MICROSOFT_ENTRA_ID_ID: string;
  AUTH_MICROSOFT_ENTRA_ID_SECRET: string;
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: string;

  // Webflow Data API
  WEBFLOW_API_TOKEN: string;
  WEBFLOW_SITE_ID: string;
  WEBFLOW_VACANCIES_COLLECTION_ID: string;
  WEBFLOW_PARTNERS_COLLECTION_ID?: string;
  WEBFLOW_WEBHOOK_SECRET?: string;

  // Comma separated emails that get the admin role on first sign in
  BOOTSTRAP_ADMIN_EMAILS?: string;
}
