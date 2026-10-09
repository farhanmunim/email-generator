import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSend, isAllowed, onRequestGet } from '../functions/api/send-test.js';

const env = { RESEND_API_KEY: 'k', FROM_EMAIL: 'Me <me@x.com>', ALLOWED_RECIPIENTS: 'me@x.com, @corp.com' };
const req = (body, origin = 'https://app.test') =>
  new Request('https://app.test/api/send-test', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ok = async () => new Response(JSON.stringify({ id: 'abc' }), { status: 200 });

test('disabled unless fully configured', async () => {
  assert.deepEqual(await onRequestGet({ env: {} }).json(), { enabled: false });
  assert.deepEqual(await onRequestGet({ env }).json(), { enabled: true });
  assert.equal((await handleSend(req({}), { RESEND_API_KEY: 'k' }, ok)).status, 404);
});

test('allow-list supports exact addresses and @domains', () => {
  assert.ok(isAllowed('ME@x.com', env.ALLOWED_RECIPIENTS));
  assert.ok(isAllowed('bob@corp.com', env.ALLOWED_RECIPIENTS));
  assert.ok(!isAllowed('evil@corp.com.attacker.io', env.ALLOWED_RECIPIENTS));
  assert.ok(!isAllowed('someone@else.com', env.ALLOWED_RECIPIENTS));
});

test('rejects cross-origin, bad, disallowed and empty requests', async () => {
  const good = { to: 'me@x.com', subject: 'Hi', html: '<p>x</p>' };
  assert.equal((await handleSend(req(good, 'https://evil.test'), env, ok)).status, 403);
  assert.equal((await handleSend(req({ ...good, to: 'nope' }), env, ok)).status, 400);
  assert.equal((await handleSend(req({ ...good, to: 'a@else.com' }), env, ok)).status, 403);
  assert.equal((await handleSend(req({ ...good, html: '' }), env, ok)).status, 400);
});

test('sends through Resend with a [Test] subject and never leaks provider errors', async () => {
  let call;
  const spy = async (url, init) => { call = { url, init, body: JSON.parse(init.body) }; return ok(); };
  const res = await handleSend(req({ to: 'me@x.com', subject: 'Hi', html: '<p>x</p>', text: 'x' }), env, spy);
  assert.equal(res.status, 200);
  assert.equal(call.url, 'https://api.resend.com/emails');
  assert.equal(call.init.headers.authorization, 'Bearer k');
  assert.equal(call.body.subject, '[Test] Hi');
  assert.deepEqual(call.body.to, ['me@x.com']);
  const fail = await handleSend(req({ to: 'me@x.com', html: '<p>x</p>' }), env, async () => new Response('secret detail', { status: 422 }));
  assert.equal(fail.status, 502);
  assert.ok(!(await fail.text()).includes('secret'));
});
