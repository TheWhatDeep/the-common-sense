import { beforeEach, describe, expect, it } from 'vitest';
import { handle } from '../server/api';
import { nextReset, usageDate } from '../server/dates';
import type { Env } from '../server/http';
import { createTestDb } from './helpers/d1';

const KEY = 'test-secret-gemini-key-123';
const BASE = 'http://localhost:8788';

const GOOD = {
  pillars: [
    { pillar: 1, applies: true, read: 'No harm is involved. Attending is support, not participation.' },
    { pillar: 2, applies: true, read: "You're weighing this rather than reacting." },
    { pillar: 3, applies: false, read: "Not a family matter. Doesn't apply here." },
    { pillar: 4, applies: true, read: 'Her wedding is her domain.' },
  ],
  bottom_line: 'Going as a guest fits your framework. Whether you go is your call.',
  safety_flag: false,
};

const COMPLETE = {
  'p1.harm': { value: 'no' },
  'p1.participate': { value: 'present', note: 'Just attending' },
  'p2.examined': { value: 'examined' },
  'p3.family': { value: 'no' },
  'p4.domain': { value: 'theirs' },
  'p4.method': { value: 'disagreement' },
  'p4.accept': { value: 'yes' },
};

/** A Gemini streamGenerateContent (SSE) reply: one thought-summary chunk, then the answer. */
function sse(chunks: unknown[], init: ResponseInit = {}) {
  return new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\r\n\r\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    ...init,
  });
}

function geminiReply(payload: unknown) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const half = Math.floor(text.length / 2);
  return sse([
    { candidates: [{ content: { parts: [{ text: '**Weighing harm**\nNo violence described.', thought: true }] } }] },
    { candidates: [{ content: { parts: [{ text: text.slice(0, half) }] } }] },
    { candidates: [{ content: { parts: [{ text: text.slice(half) }] }, finishReason: 'STOP' }] },
  ]);
}

let env: Env;
let raw: ReturnType<typeof createTestDb>['raw'];
let queue: (() => Response | Promise<Response>)[];
let geminiCalls: { url: string; init: RequestInit }[];
let now: Date;

const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
  geminiCalls.push({ url: String(url), init: init ?? {} });
  const next = queue.shift();
  if (!next) throw new Error('unexpected fetch');
  return next();
}) as typeof fetch;

function call(method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { origin: BASE };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(BASE + '/api' + path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return handle(req, env, { fetch: fakeFetch, now: () => now });
}

async function signIn(email: string, acceptDisclosure = true): Promise<string> {
  const res = await call('POST', '/auth/dev-sign-in', { body: { email, name: email.split('@')[0] } });
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  if (acceptDisclosure) expect((await call('POST', '/me/disclosure', { cookie })).status).toBe(200);
  return cookie;
}

async function answeredSituation(cookie: string): Promise<string> {
  const created = await call('POST', '/situations', { cookie, body: { text: 'A coworker invited me to her wedding.' } });
  const { id } = (await created.json()) as { id: string };
  const put = await call('PUT', `/situations/${id}/answers`, { cookie, body: { answers: COMPLETE } });
  expect(((await put.json()) as { status: string }).status).toBe('answered');
  return id;
}

beforeEach(() => {
  const t = createTestDb();
  raw = t.raw;
  env = { DB: t.d1, GEMINI_API_KEY: KEY, GEMINI_MODEL: 'test-model', DEV_LOGIN: 'true', GOOGLE_CLIENT_ID: 'cid' };
  queue = [];
  geminiCalls = [];
  now = new Date('2026-11-07T03:00:00Z'); // 11:00 in Manila
});

describe('auth and sessions', () => {
  it('requires a session for everything except sign-in', async () => {
    for (const [m, p] of [
      ['GET', '/me'],
      ['GET', '/situations'],
      ['POST', '/situations'],
      ['DELETE', '/me'],
    ])
      expect((await call(m, p, { body: m === 'POST' ? { text: 'x' } : undefined })).status).toBe(401);
  });

  it('sets a hardened 30-day session cookie and stores only its hash', async () => {
    const res = await call('POST', '/auth/dev-sign-in', { body: { email: 'a@x.com' } });
    const header = res.headers.get('set-cookie')!;
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/Secure/);
    expect(header).toMatch(/SameSite=Lax/);
    expect(header).toMatch(/Max-Age=2592000/);
    const token = header.split(';')[0].split('=')[1];
    const rows = raw.prepare('SELECT id FROM sessions').all() as { id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(token);
  });

  it('rejects expired sessions', async () => {
    const cookie = await signIn('a@x.com');
    now = new Date(now.getTime() + 31 * 86_400_000);
    expect((await call('GET', '/me', { cookie })).status).toBe(401);
  });

  it('sign-out ends the session', async () => {
    const cookie = await signIn('a@x.com');
    await call('POST', '/auth/sign-out', { cookie });
    expect((await call('GET', '/me', { cookie })).status).toBe(401);
  });

  it('dev sign-in is off unless DEV_LOGIN=true and the host is localhost', async () => {
    env.DEV_LOGIN = undefined;
    expect((await call('POST', '/auth/dev-sign-in', { body: {} })).status).toBe(404);
    env.DEV_LOGIN = 'true';
    const req = new Request('https://common-sense.pages.dev/api/auth/dev-sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect((await handle(req, env)).status).toBe(404);
  });

  it('rejects an invalid Google credential', async () => {
    queue.push(() => new Response(JSON.stringify({ keys: [] }), { headers: { 'cache-control': 'max-age=60' } }));
    const res = await call('POST', '/auth/sign-in', { body: { credential: 'aaa.bbb.ccc' } });
    expect(res.status).toBe(401);
  });

  it('blocks cross-site writes', async () => {
    const req = new Request(BASE + '/api/auth/sign-out', { method: 'POST', headers: { origin: 'https://evil.example' } });
    expect((await handle(req, env)).status).toBe(403);
  });
});

describe('disclosure', () => {
  it('a new user cannot create a situation before accepting the disclosure', async () => {
    const cookie = await signIn('new@x.com', false);
    const me = (await (await call('GET', '/me', { cookie })).json()) as { disclosureAccepted: boolean };
    expect(me.disclosureAccepted).toBe(false);
    expect((await call('POST', '/situations', { cookie, body: { text: 'hello' } })).status).toBe(403);
    await call('POST', '/me/disclosure', { cookie });
    expect((await call('POST', '/situations', { cookie, body: { text: 'hello' } })).status).toBe(201);
  });
});

describe('situations', () => {
  it('enforces the 1,000-character cap and rejects empty text', async () => {
    const cookie = await signIn('a@x.com');
    expect((await call('POST', '/situations', { cookie, body: { text: '   ' } })).status).toBe(400);
    expect((await call('POST', '/situations', { cookie, body: { text: 'x'.repeat(1001) } })).status).toBe(400);
    expect((await call('POST', '/situations', { cookie, body: { text: 'x'.repeat(1000) } })).status).toBe(201);
  });

  it('moves draft → answered as answers complete, and validates against the bank', async () => {
    const cookie = await signIn('a@x.com');
    const { id } = (await (await call('POST', '/situations', { cookie, body: { text: 'hi' } })).json()) as { id: string };
    const partial = await call('PUT', `/situations/${id}/answers`, { cookie, body: { answers: { 'p1.harm': { value: 'no' } } } });
    expect(((await partial.json()) as { status: string }).status).toBe('draft');
    const bad = await call('PUT', `/situations/${id}/answers`, { cookie, body: { answers: { 'p1.harm': { value: 'perhaps' } } } });
    expect(bad.status).toBe(400);
    const full = await call('PUT', `/situations/${id}/answers`, { cookie, body: { answers: COMPLETE } });
    const body = (await full.json()) as { status: string; answers: Record<string, unknown> };
    expect(body.status).toBe('answered');
    expect(body.answers['p1.participate']).toEqual({ value: 'present', note: 'Just attending' });
  });

  it("user A requesting user B's situation gets 404 on every route", async () => {
    const a = await signIn('a@x.com');
    const b = await signIn('b@x.com');
    const id = await answeredSituation(b);
    expect((await call('GET', `/situations/${id}`, { cookie: a })).status).toBe(404);
    expect((await call('PATCH', `/situations/${id}`, { cookie: a, body: { text: 'mine now' } })).status).toBe(404);
    expect((await call('PUT', `/situations/${id}/answers`, { cookie: a, body: { answers: {} } })).status).toBe(404);
    expect((await call('POST', `/situations/${id}/analyze`, { cookie: a })).status).toBe(404);
    expect((await call('DELETE', `/situations/${id}`, { cookie: a })).status).toBe(404);
    const list = (await (await call('GET', '/situations', { cookie: a })).json()) as { situations: unknown[] };
    expect(list.situations).toHaveLength(0);
    expect((await call('GET', `/situations/${id}`, { cookie: b })).status).toBe(200);
  });

  it('lists newest first', async () => {
    const cookie = await signIn('a@x.com');
    await call('POST', '/situations', { cookie, body: { text: 'first' } });
    now = new Date(now.getTime() + 1000);
    await call('POST', '/situations', { cookie, body: { text: 'second' } });
    const list = (await (await call('GET', '/situations', { cookie })).json()) as { situations: { text: string }[] };
    expect(list.situations.map((s) => s.text)).toEqual(['second', 'first']);
  });
});

describe('analyze', () => {
  it('calls Gemini once, stores the result and counts usage', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply(GOOD));
    const res = await call('POST', `/situations/${id}/analyze`, { cookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; result: { pillars: { applies: boolean }[]; bottom_line: string } };
    expect(body.status).toBe('analyzed');
    expect(body.result.pillars).toHaveLength(4);
    expect(body.result.pillars[2].applies).toBe(false);
    expect(body.result.bottom_line).toMatch(/your call/);

    // The prompt carries the situation and labelled answers; the key goes only in the header.
    const sent = geminiCalls[0];
    expect(sent.url).toContain('/models/test-model:streamGenerateContent?alt=sse');
    expect(sent.url).not.toContain(KEY);
    expect((sent.init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const prompt = JSON.parse(String(sent.init.body));
    expect(prompt.contents[0].parts[0].text).toContain('[p1.participate]');
    expect(prompt.contents[0].parts[0].text).toContain('Note: Just attending');
    expect(prompt.generationConfig.responseMimeType).toBe('application/json');
    expect(prompt.generationConfig.thinkingConfig.includeThoughts).toBe(true);

    const me = (await (await call('GET', '/me', { cookie })).json()) as { usage: { used: number } };
    expect(me.usage.used).toBe(1);

    // Analyzing again returns the stored result without another call or count.
    const again = await call('POST', `/situations/${id}/analyze`, { cookie });
    expect(again.status).toBe(200);
    expect(geminiCalls).toHaveLength(1);
  });

  it('malformed output retries once, then errors without counting usage', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply('not json'), () => geminiReply({ pillars: [], bottom_line: 'x', safety_flag: false }));
    const res = await call('POST', `/situations/${id}/analyze`, { cookie });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_output');
    expect(geminiCalls).toHaveLength(2);
    const me = (await (await call('GET', '/me', { cookie })).json()) as { usage: { used: number } };
    expect(me.usage.used).toBe(0);
  });

  it('a malformed first reply followed by a good one succeeds', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply('{"oops":'), () => geminiReply(GOOD));
    expect((await call('POST', `/situations/${id}/analyze`, { cookie })).status).toBe(200);
  });

  it('quota exhaustion says busy and does not count', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => new Response('{}', { status: 429 }));
    const res = await call('POST', `/situations/${id}/analyze`, { cookie });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { message: string }).message).toBe('Busy right now, try again later.');
    expect(geminiCalls).toHaveLength(1);
  });

  it('a rejected request (HTTP 400) is a retryable error, not counted', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(
      () =>
        new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'Invalid value at thinking_level' } }), {
          status: 400,
        }),
    );
    const res = await call('POST', `/situations/${id}/analyze`, { cookie });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe('upstream_error');
    expect(geminiCalls).toHaveLength(1);
    const me = (await (await call('GET', '/me', { cookie })).json()) as { usage: { used: number } };
    expect(me.usage.used).toBe(0);
  });

  it('a timeout returns a retryable error', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    });
    expect((await call('POST', `/situations/${id}/analyze`, { cookie })).status).toBe(504);
  });

  it('blocked content keeps the situation as a draft', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => sse([{ promptFeedback: { blockReason: 'SAFETY' } }]));
    expect((await call('POST', `/situations/${id}/analyze`, { cookie })).status).toBe(422);
    const s = (await (await call('GET', `/situations/${id}`, { cookie })).json()) as { status: string };
    expect(s.status).toBe('draft');
  });

  it('refuses incomplete interviews', async () => {
    const cookie = await signIn('a@x.com');
    const { id } = (await (await call('POST', '/situations', { cookie, body: { text: 'hi' } })).json()) as { id: string };
    expect((await call('POST', `/situations/${id}/analyze`, { cookie })).status).toBe(409);
  });

  it('the sixth analysis in a day is refused with the reset time, and resets at Manila midnight', async () => {
    const cookie = await signIn('a@x.com');
    for (let i = 0; i < 5; i++) {
      const id = await answeredSituation(cookie);
      queue.push(() => geminiReply(GOOD));
      expect((await call('POST', `/situations/${id}/analyze`, { cookie })).status).toBe(200);
    }
    const sixth = await answeredSituation(cookie);
    const res = await call('POST', `/situations/${sixth}/analyze`, { cookie });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { resetsAt: string };
    expect(body.resetsAt).toBe('2026-11-07T16:00:00.000Z'); // midnight Nov 8 in Manila
    expect(geminiCalls).toHaveLength(5);

    const me = (await (await call('GET', '/me', { cookie })).json()) as { usage: { remaining: number; resetsAt: string } };
    expect(me.usage.remaining).toBe(0);

    now = new Date('2026-11-07T16:00:01Z');
    queue.push(() => geminiReply(GOOD));
    expect((await call('POST', `/situations/${sixth}/analyze`, { cookie })).status).toBe(200);
  });

  it('the Gemini key never appears in any API response', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply(GOOD));
    const bodies = await Promise.all(
      [
        call('GET', '/auth/config'),
        call('GET', '/me', { cookie }),
        call('POST', `/situations/${id}/analyze`, { cookie }),
        call('GET', `/situations/${id}`, { cookie }),
        call('GET', '/situations', { cookie }),
      ].map(async (p) => {
        const r = await p;
        return [...r.headers.entries()].join() + (await r.text());
      }),
    );
    for (const b of bodies) expect(b).not.toContain(KEY);
  });
});

async function readEvents(res: Response) {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null');
      return { event, data };
    });
}

function callStream(path: string, cookie: string) {
  const req = new Request(BASE + '/api' + path, {
    method: 'POST',
    headers: { origin: BASE, cookie, accept: 'text/event-stream' },
  });
  return handle(req, env, { fetch: fakeFetch, now: () => now });
}

describe('streaming analyze', () => {
  it('streams thought summaries, then the stored result', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply(GOOD));
    const res = await callStream(`/situations/${id}/analyze`, cookie);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const events = await readEvents(res);
    expect(events.map((e) => e.event)).toEqual(['start', 'thought', 'result']);
    expect(events[1].data.text).toContain('Weighing harm');
    expect(events[2].data.status).toBe('analyzed');
    expect(events[2].data.result.pillars).toHaveLength(4);
    const me = (await (await call('GET', '/me', { cookie })).json()) as { usage: { used: number } };
    expect(me.usage.used).toBe(1);
  });

  it('reports a retry, then an error event, without counting usage', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply('nope'), () => geminiReply('still nope'));
    const events = await readEvents(await callStream(`/situations/${id}/analyze`, cookie));
    expect(events.map((e) => e.event)).toEqual(['start', 'thought', 'retry', 'thought', 'error']);
    expect(events.at(-1)!.data.error).toBe('invalid_output');
    const me = (await (await call('GET', '/me', { cookie })).json()) as { usage: { used: number } };
    expect(me.usage.used).toBe(0);
  });

  it('checks that fail before Gemini is called come back as plain JSON', async () => {
    const cookie = await signIn('a@x.com');
    const { id } = (await (await call('POST', '/situations', { cookie, body: { text: 'hi' } })).json()) as { id: string };
    const res = await callStream(`/situations/${id}/analyze`, cookie);
    expect(res.status).toBe(409);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('never sends the key or the thoughts to the logs', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply(GOOD));
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => lines.push(a.join(' '));
    try {
      await readEvents(await callStream(`/situations/${id}/analyze`, cookie));
    } finally {
      console.log = orig;
    }
    const all = lines.join('\n');
    expect(all).toContain('gemini_call');
    expect(all).not.toContain(KEY);
    expect(all).not.toContain('Weighing harm');
    expect(all).not.toContain('coworker');
  });
});

describe('fallback model', () => {
  it('when the main model times out, the fallback model writes the read', async () => {
    env.GEMINI_FALLBACK_MODEL = 'lite-model';
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(
      () => {
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      },
      () => geminiReply(GOOD),
    );
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => lines.push(a.join(' '));
    let events;
    try {
      events = await readEvents(await callStream(`/situations/${id}/analyze`, cookie));
    } finally {
      console.log = orig;
    }
    expect(events.map((e) => e.event)).toEqual(['start', 'fallback', 'thought', 'result']);
    expect(geminiCalls[0].url).toContain('/models/test-model:');
    expect(geminiCalls[1].url).toContain('/models/lite-model:');
    // The lighter model is called without thinking settings.
    expect(JSON.parse(String(geminiCalls[1].init.body)).generationConfig.thinkingConfig).toBeUndefined();
    const log = JSON.parse(lines.find((l) => l.includes('gemini_call'))!);
    expect(log.model).toBe('lite-model');
    expect(log.fallbackFrom).toMatchObject({ model: 'test-model', reason: 'timeout' });
    const s = (await (await call('GET', `/situations/${id}`, { cookie })).json()) as { result: { model: string } };
    expect(s.result.model).toBe('lite-model');
  });

  it('does not fall back on blocked content', async () => {
    env.GEMINI_FALLBACK_MODEL = 'lite-model';
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => sse([{ promptFeedback: { blockReason: 'SAFETY' } }]));
    expect((await call('POST', `/situations/${id}/analyze`, { cookie })).status).toBe(422);
    expect(geminiCalls).toHaveLength(1);
  });
});

describe('saved reads and the dashboard list', () => {
  it('saves and unsaves a finished read, and refuses drafts', async () => {
    const cookie = await signIn('a@x.com');
    const draft = (await (await call('POST', '/situations', { cookie, body: { text: 'draft' } })).json()) as { id: string };
    expect((await call('PUT', `/situations/${draft.id}/saved`, { cookie, body: { saved: true } })).status).toBe(409);

    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply(GOOD));
    await call('POST', `/situations/${id}/analyze`, { cookie });
    const saved = await call('PUT', `/situations/${id}/saved`, { cookie, body: { saved: true } });
    expect(((await saved.json()) as { saved: boolean }).saved).toBe(true);
    let list = (await (await call('GET', '/situations', { cookie })).json()) as { situations: { id: string; saved: boolean }[] };
    expect(list.situations.find((s) => s.id === id)!.saved).toBe(true);
    await call('PUT', `/situations/${id}/saved`, { cookie, body: { saved: false } });
    list = (await (await call('GET', '/situations', { cookie })).json()) as { situations: { id: string; saved: boolean }[] };
    expect(list.situations.find((s) => s.id === id)!.saved).toBe(false);
  });

  it("another user's situation can't be saved (404)", async () => {
    const a = await signIn('a@x.com');
    const b = await signIn('b@x.com');
    const id = await answeredSituation(b);
    expect((await call('PUT', `/situations/${id}/saved`, { cookie: a, body: { saved: true } })).status).toBe(404);
  });

  it('tells the dashboard which step a draft resumes at', async () => {
    const cookie = await signIn('a@x.com');
    const { id } = (await (await call('POST', '/situations', { cookie, body: { text: 'hi' } })).json()) as { id: string };
    await call('PUT', `/situations/${id}/answers`, {
      cookie,
      body: { answers: { 'p1.harm': { value: 'no' }, 'p1.participate': { value: 'present' } } },
    });
    const list = (await (await call('GET', '/situations', { cookie })).json()) as { situations: { step: number }[] };
    expect(list.situations[0].step).toBe(3);
  });
});

describe('deletion', () => {
  it('deleting a situation removes its answers and result', async () => {
    const cookie = await signIn('a@x.com');
    const id = await answeredSituation(cookie);
    queue.push(() => geminiReply(GOOD));
    await call('POST', `/situations/${id}/analyze`, { cookie });
    expect((await call('DELETE', `/situations/${id}`, { cookie })).status).toBe(200);
    for (const t of ['situations', 'answers', 'results'])
      expect((raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0);
  });

  it("deleting the account removes all of the user's rows and nobody else's", async () => {
    const a = await signIn('a@x.com');
    const b = await signIn('b@x.com');
    for (const c of [a, b]) {
      const id = await answeredSituation(c);
      queue.push(() => geminiReply(GOOD));
      await call('POST', `/situations/${id}/analyze`, { cookie: c });
    }
    expect((await call('DELETE', '/me', { cookie: a })).status).toBe(200);
    expect((await call('GET', '/me', { cookie: a })).status).toBe(401);
    const count = (t: string) => (raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    expect(count('users')).toBe(1);
    expect(count('sessions')).toBe(1);
    expect(count('situations')).toBe(1);
    expect(count('answers')).toBe(Object.keys(COMPLETE).length);
    expect(count('results')).toBe(1);
    expect(count('usage')).toBe(1);
  });
});

describe('dates', () => {
  it('uses the Manila calendar day', () => {
    expect(usageDate(new Date('2026-11-07T15:59:59Z'))).toBe('2026-11-07');
    expect(usageDate(new Date('2026-11-07T16:00:00Z'))).toBe('2026-11-08');
    expect(nextReset(new Date('2026-11-07T03:00:00Z')).toISOString()).toBe('2026-11-07T16:00:00.000Z');
  });
});
