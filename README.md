# SFL UK Resources Mirror

Serves a live mirror of **sfltech.ai/resources** at **sfltech.co.uk/resources**.
Deployed with [Webflow Cloud](https://developers.webflow.com/webflow-cloud), attached to the
SFL UK Webflow site with mount path `/resources`.

## How it works

- Every request under `/resources` is fetched live from the same path on `https://www.sfltech.ai`.
- The page is served unchanged (no styling, content or layout changes). sfltech.ai stays the only CMS.
- Root-relative links outside `/resources` (nav, footer, contact) are rewritten to absolute
  `https://www.sfltech.ai/...` URLs. Links inside `/resources` stay on the UK domain.
- Canonical tags are left pointing at sfltech.ai, so search engines credit the originals.
- Redirects that stay inside `/resources` keep the visitor on the UK domain.

## Files

- `src/pages/[...path].js` — catch-all route that fetches and serves the mirrored page
- `src/lib/mirror.js` — URL mapping and link-rewrite logic
- `tests/mirror.test.js` — unit tests (`npm test`)

## Maintenance

No content upkeep: anything published on sfltech.ai appears here automatically.
If the sfltech.ai resources template changes its link structure, re-run the tests and check
`rewriteHtml` in `src/lib/mirror.js`.

## Deploy

Pushes to `main` deploy automatically through Webflow Cloud. Do not set `base` or an adapter in
`astro.config.mjs`; Webflow Cloud sets them at build time.
