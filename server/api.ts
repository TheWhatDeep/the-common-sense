/**
 * Every /api route. Pages Functions hands requests here (functions/api/[[path]].ts),
 * and the tests call handle() directly with a SQLite-backed stand-in for D1.
 *
 * Rule of thumb: every query that touches user data filters by the session's
 * user_id, and someone else's row is reported as 404, never 403.
 */
import { CONFIG } from '../shared/config';
import {
  BANK_VERSION,
  cleanAnswers,
  getBank,
  interviewComplete,
  type Answers,
} from '../shared/questionBank';
import { parseResult, type AnalysisResult } from '../shared/result';
import { nextReset, usageDate } from './dates';
import { analyzeWithGemini } from './gemini';
import { verifyGoogleIdToken } from './google';
import { HttpError, errorResponse, json, newId, randomToken, readJson, sha256, type Env } from './http';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

export interface Deps {
  fetch?: typeof fetch;
  now?: () => Date;
}

const COOKIE = 'tcs_session';

interface Ctx {
  request: Request;
  env: Env;
  deps: Deps;
  url: URL;
  params: Record<string, string>;
  now: Date;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  disclosure_accepted_at: string | null;
}

interface SituationRow {
  id: string;
  user_id: string;
  text: string;
  status: 'draft' | 'answered' | 'analyzed';
  bank_version: number;
  created_at: string;
  updated_at: string;
}

type Handler = (ctx: Ctx) => Promise<Response>;

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];
function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' + path.replace(/:([a-z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$',
  );
  routes.push({ method, pattern, keys, handler });
}

export async function handle(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') checkOrigin(request, url);
    let methodMismatch = false;
    for (const r of routes) {
      const m = r.pattern.exec(path);
      if (!m) continue;
      if (r.method !== request.method) {
        methodMismatch = true;
        continue;
      }
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return await r.handler({ request, env, deps, url, params, now: deps.now?.() ?? new Date() });
    }
    throw methodMismatch ? new HttpError(405, 'method_not_allowed') : new HttpError(404, 'not_found');
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err);
    // Log the error type only: never request bodies, situation text, or secrets.
    console.error('api_error', path, (err as Error)?.name);
    return json({ error: 'server_error', message: 'Something went wrong.' }, 500);
  }
}

/** Blocks cross-site writes. Browsers always send Origin on POST/PUT/PATCH/DELETE. */
function checkOrigin(request: Request, url: URL) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) throw new HttpError(403, 'bad_origin');
}

// ---------- sessions ----------

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function sessionCookie(token: string, maxAge: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function requireUser(ctx: Ctx): Promise<UserRow> {
  const token = readCookie(ctx.request, COOKIE);
  if (!token) throw new HttpError(401, 'unauthenticated', 'Please sign in.');
  const user = await ctx.env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.disclosure_accepted_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), ctx.now.toISOString())
    .first<UserRow>();
  if (!user) throw new HttpError(401, 'unauthenticated', 'Please sign in.');
  return user;
}

async function startSession(ctx: Ctx, userId: string): Promise<string> {
  const token = randomToken();
  const expires = new Date(ctx.now.getTime() + CONFIG.sessionDays * 86_400_000);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(userId, ctx.now.toISOString()),
    ctx.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(
      await sha256(token),
      userId,
      expires.toISOString(),
      ctx.now.toISOString(),
    ),
  ]);
  return sessionCookie(token, CONFIG.sessionDays * 86_400);
}

async function upsertUser(ctx: Ctx, sub: string, email: string, name: string): Promise<string> {
  const existing = await ctx.env.DB.prepare('SELECT id FROM users WHERE google_sub = ?').bind(sub).first<{ id: string }>();
  if (existing) {
    await ctx.env.DB.prepare('UPDATE users SET email = ?, display_name = ? WHERE id = ?').bind(email, name, existing.id).run();
    return existing.id;
  }
  const id = newId();
  await ctx.env.DB.prepare(
    'INSERT INTO users (id, google_sub, email, display_name, disclosure_accepted_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
  )
    .bind(id, sub, email, name, ctx.now.toISOString())
    .run();
  return id;
}

// ---------- shared loaders ----------

async function usageInfo(ctx: Ctx, userId: string) {
  const row = await ctx.env.DB.prepare('SELECT count FROM usage WHERE user_id = ? AND date = ?')
    .bind(userId, usageDate(ctx.now))
    .first<{ count: number }>();
  const used = row?.count ?? 0;
  return {
    used,
    cap: CONFIG.dailyCap,
    remaining: Math.max(0, CONFIG.dailyCap - used),
    resetsAt: nextReset(ctx.now).toISOString(),
  };
}

async function mePayload(ctx: Ctx, user: UserRow) {
  return {
    user: { id: user.id, email: user.email, displayName: user.display_name },
    disclosureAccepted: !!user.disclosure_accepted_at,
    usage: await usageInfo(ctx, user.id),
  };
}

async function loadSituation(ctx: Ctx, userId: string, id: string): Promise<SituationRow> {
  const row = await ctx.env.DB.prepare('SELECT * FROM situations WHERE id = ? AND user_id = ?').bind(id, userId).first<SituationRow>();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

async function loadAnswers(ctx: Ctx, situationId: string): Promise<Answers> {
  const { results } = await ctx.env.DB.prepare('SELECT question_id, value, note FROM answers WHERE situation_id = ?')
    .bind(situationId)
    .all<{ question_id: string; value: string; note: string | null }>();
  const answers: Answers = {};
  for (const r of results) answers[r.question_id] = r.note ? { value: r.value, note: r.note } : { value: r.value };
  return answers;
}

async function situationPayload(ctx: Ctx, row: SituationRow) {
  const answers = await loadAnswers(ctx, row.id);
  const res = await ctx.env.DB.prepare('SELECT payload_json, model, created_at FROM results WHERE situation_id = ?')
    .bind(row.id)
    .first<{ payload_json: string; model: string; created_at: string }>();
  let result: (AnalysisResult & { model: string; createdAt: string }) | null = null;
  if (res) {
    const parsed = parseResult(res.payload_json);
    if (parsed) result = { ...parsed, model: res.model, createdAt: res.created_at };
  }
  return {
    id: row.id,
    text: row.text,
    status: row.status,
    bankVersion: row.bank_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    answers,
    result,
  };
}

function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') throw new HttpError(400, 'bad_text', 'Describe the situation.');
  const text = raw.trim();
  if (!text) throw new HttpError(400, 'bad_text', 'Describe the situation.');
  if (text.length > CONFIG.situationMaxChars)
    throw new HttpError(400, 'text_too_long', `Keep it under ${CONFIG.situationMaxChars} characters.`);
  return text;
}

function isLocalhost(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

// ---------- auth ----------

route('GET', '/auth/config', async (ctx) =>
  json({
    googleClientId: ctx.env.GOOGLE_CLIENT_ID ?? '',
    devLogin: ctx.env.DEV_LOGIN === 'true' && isLocalhost(ctx.url),
  }),
);

route('POST', '/auth/sign-in', async (ctx) => {
  const body = await readJson(ctx.request);
  if (typeof body.credential !== 'string') throw new HttpError(400, 'bad_credential');
  const identity = await verifyGoogleIdToken(body.credential, ctx.env.GOOGLE_CLIENT_ID ?? '', ctx.deps.fetch ?? fetch, ctx.now.getTime());
  if (!identity) throw new HttpError(401, 'sign_in_failed', 'Google sign-in could not be verified.');
  const userId = await upsertUser(ctx, identity.sub, identity.email, identity.name);
  const cookie = await startSession(ctx, userId);
  const user = await ctx.env.DB.prepare('SELECT id, email, display_name, disclosure_accepted_at FROM users WHERE id = ?')
    .bind(userId)
    .first<UserRow>();
  return json(await mePayload(ctx, user!), 200, { 'set-cookie': cookie });
});

/** Local development only: needs DEV_LOGIN=true AND a localhost request. */
route('POST', '/auth/dev-sign-in', async (ctx) => {
  if (ctx.env.DEV_LOGIN !== 'true' || !isLocalhost(ctx.url)) throw new HttpError(404, 'not_found');
  const body = await readJson(ctx.request);
  const email = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim().toLowerCase() : 'dev@example.com';
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Dev User';
  const userId = await upsertUser(ctx, `dev:${email}`, email, name);
  const cookie = await startSession(ctx, userId);
  const user = await ctx.env.DB.prepare('SELECT id, email, display_name, disclosure_accepted_at FROM users WHERE id = ?')
    .bind(userId)
    .first<UserRow>();
  return json(await mePayload(ctx, user!), 200, { 'set-cookie': cookie });
});

route('POST', '/auth/sign-out', async (ctx) => {
  const token = readCookie(ctx.request, COOKIE);
  if (token) await ctx.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
});

// ---------- me ----------

route('GET', '/me', async (ctx) => json(await mePayload(ctx, await requireUser(ctx))));

route('POST', '/me/disclosure', async (ctx) => {
  const user = await requireUser(ctx);
  if (!user.disclosure_accepted_at) {
    user.disclosure_accepted_at = ctx.now.toISOString();
    await ctx.env.DB.prepare('UPDATE users SET disclosure_accepted_at = ? WHERE id = ?').bind(user.disclosure_accepted_at, user.id).run();
  }
  return json(await mePayload(ctx, user));
});

route('DELETE', '/me', async (ctx) => {
  const user = await requireUser(ctx);
  const db = ctx.env.DB;
  const mine = 'SELECT id FROM situations WHERE user_id = ?';
  await db.batch([
    db.prepare(`DELETE FROM answers WHERE situation_id IN (${mine})`).bind(user.id),
    db.prepare(`DELETE FROM results WHERE situation_id IN (${mine})`).bind(user.id),
    db.prepare('DELETE FROM situations WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM usage WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
});

// ---------- situations ----------

route('POST', '/situations', async (ctx) => {
  const user = await requireUser(ctx);
  if (!user.disclosure_accepted_at) throw new HttpError(403, 'disclosure_required', 'Accept the data notice first.');
  const text = cleanText((await readJson(ctx.request)).text);
  const id = newId();
  const ts = ctx.now.toISOString();
  await ctx.env.DB.prepare(
    "INSERT INTO situations (id, user_id, text, status, bank_version, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)",
  )
    .bind(id, user.id, text, BANK_VERSION, ts, ts)
    .run();
  return json(await situationPayload(ctx, await loadSituation(ctx, user.id, id)), 201);
});

route('GET', '/situations', async (ctx) => {
  const user = await requireUser(ctx);
  const { results } = await ctx.env.DB.prepare(
    `SELECT s.id, s.text, s.status, s.created_at, s.updated_at, r.payload_json
       FROM situations s LEFT JOIN results r ON r.situation_id = s.id
      WHERE s.user_id = ? ORDER BY s.created_at DESC`,
  )
    .bind(user.id)
    .all<{ id: string; text: string; status: string; created_at: string; updated_at: string; payload_json: string | null }>();
  return json({
    situations: results.map((r) => ({
      id: r.id,
      text: r.text,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      bottomLine: r.payload_json ? (parseResult(r.payload_json)?.bottom_line ?? null) : null,
    })),
  });
});

route('GET', '/situations/:id', async (ctx) => {
  const user = await requireUser(ctx);
  return json(await situationPayload(ctx, await loadSituation(ctx, user.id, ctx.params.id)));
});

/** Edit the situation text (going back to step 1). Not in spec v0.1's table; needed for back navigation. */
route('PATCH', '/situations/:id', async (ctx) => {
  const user = await requireUser(ctx);
  const row = await loadSituation(ctx, user.id, ctx.params.id);
  if (row.status === 'analyzed') throw new HttpError(409, 'already_analyzed', 'This situation already has a read.');
  const text = cleanText((await readJson(ctx.request)).text);
  await ctx.env.DB.prepare('UPDATE situations SET text = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(text, ctx.now.toISOString(), row.id, user.id)
    .run();
  return json(await situationPayload(ctx, await loadSituation(ctx, user.id, row.id)));
});

route('PUT', '/situations/:id/answers', async (ctx) => {
  const user = await requireUser(ctx);
  const row = await loadSituation(ctx, user.id, ctx.params.id);
  if (row.status === 'analyzed') throw new HttpError(409, 'already_analyzed', 'This situation already has a read.');
  const bank = getBank(row.bank_version);
  const cleaned = cleanAnswers((await readJson(ctx.request)).answers, bank);
  if (!cleaned.ok) throw new HttpError(400, 'bad_answers', cleaned.error);
  const status = interviewComplete(cleaned.answers, bank) ? 'answered' : 'draft';
  const db = ctx.env.DB;
  await db.batch([
    db.prepare('DELETE FROM answers WHERE situation_id = ?').bind(row.id),
    ...Object.entries(cleaned.answers).map(([qid, a]) =>
      db.prepare('INSERT INTO answers (id, situation_id, question_id, value, note) VALUES (?, ?, ?, ?, ?)').bind(
        newId(),
        row.id,
        qid,
        a.value,
        a.note ?? null,
      ),
    ),
    db.prepare('UPDATE situations SET status = ?, updated_at = ? WHERE id = ?').bind(status, ctx.now.toISOString(), row.id),
  ]);
  return json(await situationPayload(ctx, await loadSituation(ctx, user.id, row.id)));
});

route('POST', '/situations/:id/analyze', async (ctx) => {
  const user = await requireUser(ctx);
  const row = await loadSituation(ctx, user.id, ctx.params.id);
  if (row.status === 'analyzed') return json(await situationPayload(ctx, row));

  const answers = await loadAnswers(ctx, row.id);
  if (row.status !== 'answered' || !interviewComplete(answers, getBank(row.bank_version)))
    throw new HttpError(409, 'incomplete', 'Answer every question first.');

  const usage = await usageInfo(ctx, user.id);
  if (usage.remaining <= 0)
    throw new HttpError(429, 'daily_limit', "You've used today's analyses.", { resetsAt: usage.resetsAt });

  if (!ctx.env.GEMINI_API_KEY) throw new HttpError(500, 'not_configured', 'The AI is not configured yet.');
  const model = ctx.env.GEMINI_MODEL || CONFIG.defaultGeminiModel;
  const outcome = await analyzeWithGemini({
    apiKey: ctx.env.GEMINI_API_KEY,
    model,
    baseUrl: ctx.env.GEMINI_BASE_URL,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(row.text, answers, row.bank_version),
    fetchImpl: ctx.deps.fetch,
  });
  // Diagnostics only: outcome, upstream status and timing. Never situation text or the key.
  console.log(
    JSON.stringify({
      event: 'gemini_call',
      model,
      ok: outcome.ok,
      reason: outcome.ok ? undefined : outcome.reason,
      httpStatus: outcome.httpStatus,
      detail: outcome.detail,
      ms: outcome.ms,
      attempts: outcome.attempts,
    }),
  );

  if (!outcome.ok) {
    switch (outcome.reason) {
      case 'quota':
        throw new HttpError(503, 'busy', 'Busy right now, try again later.');
      case 'timeout':
        throw new HttpError(504, 'timeout', 'That took too long. Try again.');
      case 'blocked':
        await ctx.env.DB.prepare("UPDATE situations SET status = 'draft', updated_at = ? WHERE id = ?")
          .bind(ctx.now.toISOString(), row.id)
          .run();
        throw new HttpError(422, 'blocked', "This one can't be analyzed. Your situation is saved as a draft.");
      case 'invalid':
        throw new HttpError(502, 'invalid_output', 'The read came back garbled. Try again.');
      default:
        throw new HttpError(502, 'upstream_error', 'Something went wrong. Try again.');
    }
  }

  const ts = ctx.now.toISOString();
  const inserted = await ctx.env.DB.prepare(
    'INSERT INTO results (id, situation_id, payload_json, model, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(situation_id) DO NOTHING',
  )
    .bind(newId(), row.id, JSON.stringify(outcome.result), model, ts)
    .run();
  // A parallel request already stored a result: return it and don't count this one twice.
  if (inserted.meta.changes > 0) {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE situations SET status = 'analyzed', updated_at = ? WHERE id = ?").bind(ts, row.id),
      ctx.env.DB.prepare(
        'INSERT INTO usage (user_id, date, count) VALUES (?, ?, 1) ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1',
      ).bind(user.id, usageDate(ctx.now)),
    ]);
  }
  return json(await situationPayload(ctx, await loadSituation(ctx, user.id, row.id)));
});

route('DELETE', '/situations/:id', async (ctx) => {
  const user = await requireUser(ctx);
  const row = await loadSituation(ctx, user.id, ctx.params.id);
  const db = ctx.env.DB;
  await db.batch([
    db.prepare('DELETE FROM answers WHERE situation_id = ?').bind(row.id),
    db.prepare('DELETE FROM results WHERE situation_id = ?').bind(row.id),
    db.prepare('DELETE FROM situations WHERE id = ? AND user_id = ?').bind(row.id, user.id),
  ]);
  return json({ ok: true });
});
