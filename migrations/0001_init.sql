-- Team portal schema (Cloudflare D1 / SQLite)

CREATE TABLE users (
  email       TEXT PRIMARY KEY,
  name        TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin','hr_editor','sales_manager','sales_rep')),
  region      TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);

-- Vacancies and partner listings published to the Webflow CMS
CREATE TABLE listings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  kind             TEXT NOT NULL CHECK (kind IN ('vacancy','partner')),
  ref_code         TEXT NOT NULL,              -- Job ID or partner listing code, e.g. SL-001
  title            TEXT NOT NULL,
  fields_json      TEXT NOT NULL,              -- form values (department, location, ...)
  description_text TEXT NOT NULL DEFAULT '',
  clickup_link     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  webflow_item_id  TEXT,
  created_by       TEXT NOT NULL,
  updated_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, ref_code)
);

-- Leads pulled from Webflow form submissions
CREATE TABLE leads (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  webflow_submission_id TEXT NOT NULL UNIQUE,
  source                TEXT NOT NULL,          -- assessment_cvp | assessment_ai | partner | contact
  form_name             TEXT NOT NULL,
  full_name             TEXT,
  email                 TEXT,
  company               TEXT,
  job_title             TEXT,
  country               TEXT,
  result_level          TEXT,
  report_url            TEXT,
  payload_json          TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','assigned','contacted','qualified','won','lost')),
  assigned_to           TEXT REFERENCES users(email),
  submitted_at          TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leads_assigned ON leads (assigned_to, status);
CREATE INDEX idx_leads_submitted ON leads (submitted_at DESC);

CREATE TABLE lead_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL,
  kind        TEXT NOT NULL,                    -- assigned | status | note
  detail      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lead_events_lead ON lead_events (lead_id, created_at);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT NOT NULL,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sync_state (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
