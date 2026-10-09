// Optional Cloudflare Pages Function: sends a test email through Resend.
// Disabled unless RESEND_API_KEY, FROM_EMAIL and ALLOWED_RECIPIENTS are set.
// ALLOWED_RECIPIENTS (comma separated: "me@x.com, @mycompany.com") stops the
// endpoint being used to send mail to arbitrary people.

const MAX_BYTES = 400_000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const isConfigured = (env) => Boolean(env && env.RESEND_API_KEY && env.FROM_EMAIL && env.ALLOWED_RECIPIENTS);

export function isAllowed(to, allowList) {
  const addr = to.toLowerCase();
  return String(allowList || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => (rule.startsWith('@') ? addr.endsWith(rule) : addr === rule));
}

export async function handleSend(request, env, fetchImpl = fetch) {
  if (!isConfigured(env)) return json({ error: 'Test sending is not configured.' }, 404);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Forbidden.' }, 403);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BYTES) return json({ error: 'Email is too large to send as a test.' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const to = String(body.to || '').trim();
  if (!EMAIL.test(to)) return json({ error: 'Enter a valid email address.' }, 400);
  if (!isAllowed(to, env.ALLOWED_RECIPIENTS)) return json({ error: 'That address is not on the allowed recipients list.' }, 403);
  if (typeof body.html !== 'string' || !body.html.trim()) return json({ error: 'There is no email content to send.' }, 400);
  const subject = `[Test] ${String(body.subject || '').trim() || 'Email preview'}`.slice(0, 200);

  let res;
  try {
    res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [to],
        subject,
        html: body.html,
        ...(typeof body.text === 'string' && body.text.trim() && { text: body.text }),
      }),
    });
  } catch {
    return json({ error: 'Could not reach the email provider.' }, 502);
  }
  if (!res.ok) return json({ error: 'The email provider rejected the request. Check the sender address and API key.' }, 502);
  const data = await res.json().catch(() => ({}));
  return json({ ok: true, id: data.id || null });
}

export const onRequestGet = ({ env }) => json({ enabled: isConfigured(env) });
export const onRequestPost = ({ request, env }) => handleSend(request, env);
