import { upstreamUrl, rewriteHtml, rewriteLocation } from '../lib/mirror.js';

// Every request is rendered on demand so content is always live.
export const prerender = false;

// Response headers from sfltech.ai that must not be forwarded.
// frame-ancestors / cookies / encoding are origin-specific.
const DROP_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'set-cookie',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'alt-svc',
  'strict-transport-security',
];

async function mirror({ params, url, request }) {
  const target = upstreamUrl(params.path, url.search);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      redirect: 'manual',
      headers: {
        accept: request.headers.get('accept') || 'text/html',
        'accept-language': request.headers.get('accept-language') || 'en',
        'user-agent': 'SFL-UK-Resources-Mirror/1.0 (+https://www.sfltech.co.uk)',
      },
    });
  } catch (err) {
    console.error('mirror: upstream fetch failed', target, err);
    return new Response('Resources are temporarily unavailable. Please try again shortly.', {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const headers = new Headers(upstream.headers);
  for (const h of DROP_HEADERS) headers.delete(h);
  headers.set('x-mirrored-from', target);

  // Redirects: keep visitors on the UK domain when they stay in /resources.
  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = rewriteLocation(upstream.headers.get('location'));
    if (loc) headers.set('location', loc);
    return new Response(null, { status: upstream.status, headers });
  }

  const type = upstream.headers.get('content-type') || '';
  if (request.method === 'HEAD' || !type.includes('text/html')) {
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  const html = rewriteHtml(await upstream.text());
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status: upstream.status, headers });
}

export const GET = mirror;
export const HEAD = mirror;
