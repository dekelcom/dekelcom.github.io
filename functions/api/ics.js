// Cloudflare Pages Function: GET /api/ics?url=<calendar subscription URL>
// Fetches a calendar feed (.ics) server-side so the family dashboard can read it
// (calendar providers don't allow direct browser fetches). Only well-known
// calendar hosts are allowed, so this can't be used as an open proxy.
const ALLOWED = [
  /(^|\.)calendar\.google\.com$/,
  /(^|\.)googleusercontent\.com$/,
  /(^|\.)icloud\.com$/,
  /^outlook\.office365\.com$/,
  /^outlook\.live\.com$/,
  /(^|\.)outlook\.office\.com$/,
];

export async function onRequestGet({ request }) {
  const raw = new URL(request.url).searchParams.get('url') || '';
  let target;
  try {
    target = new URL(raw.trim().replace(/^webcals?:/i, 'https:'));
  } catch {
    return new Response('bad url', { status: 400 });
  }
  if (target.protocol !== 'https:' || !ALLOWED.some((r) => r.test(target.hostname))) {
    return new Response('host not allowed', { status: 403 });
  }
  let res;
  try {
    res = await fetch(target.toString(), {
      headers: { 'user-agent': 'family-dashboard/1.0', accept: 'text/calendar,*/*' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
  } catch {
    return new Response('upstream unreachable', { status: 502 });
  }
  const body = await res.text();
  if (!res.ok || !body.includes('BEGIN:VCALENDAR')) {
    return new Response('not a calendar feed (status ' + res.status + ')', { status: 502 });
  }
  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'private, max-age=300',
      'x-robots-tag': 'noindex',
    },
  });
}
