// Core mirror logic, kept framework-free so it can be unit tested.
//
// sfltech.ai is the single source of truth. Every request under the UK
// mount (/resources) is fetched live from the same path on sfltech.ai and
// served unchanged, except for one thing: root-relative links that point
// OUTSIDE /resources are made absolute to sfltech.ai, because those pages
// do not exist on sfltech.co.uk. Links inside /resources stay relative so
// visitors keep browsing on the UK domain.

export const ORIGIN = 'https://www.sfltech.ai';
export const MOUNT = '/resources';

/** True when a root-relative path (no leading slash) belongs to /resources. */
export function isResourcesPath(pathNoSlash) {
  return /^resources(?=$|[/?#])/.test(pathNoSlash);
}

/** Build the upstream URL for an incoming sub-path and query string. */
export function upstreamUrl(subPath, search = '') {
  const clean = (subPath || '').replace(/^\/+/, '');
  return `${ORIGIN}${MOUNT}${clean ? '/' + clean : ''}${search || ''}`;
}

/**
 * Rewrite root-relative href/action/src attributes that point outside
 * /resources to absolute sfltech.ai URLs. Protocol-relative (//) and
 * absolute URLs are left alone.
 */
export function rewriteHtml(html) {
  return html.replace(
    /(\s(?:href|action|src)=)(["'])\/(?!\/)([^"']*)\2/gi,
    (match, attr, quote, path) =>
      isResourcesPath(path) ? match : `${attr}${quote}${ORIGIN}/${path}${quote}`,
  );
}

/**
 * Map an upstream redirect Location to what the UK visitor should see.
 * Redirects that stay inside /resources keep the UK domain.
 */
export function rewriteLocation(location) {
  if (!location) return location;
  let u;
  try {
    u = new URL(location, ORIGIN);
  } catch {
    return location;
  }
  const sameSite = u.hostname === 'sfltech.ai' || u.hostname === 'www.sfltech.ai';
  if (sameSite && isResourcesPath(u.pathname.replace(/^\//, ''))) {
    return `${u.pathname}${u.search}${u.hash}`;
  }
  return u.toString();
}
