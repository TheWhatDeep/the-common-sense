/**
 * The one place the app talks to Gemini. The API key goes in a header and is
 * never logged, echoed or returned.
 *
 * Uses streamGenerateContent with thought summaries turned on, so the waiting
 * screen can show what the model is working through. Because data keeps
 * arriving, the timeout is an *idle* timeout (no data for N seconds), plus a
 * hard total cap.
 */
import { CONFIG } from '../shared/config';
import { parseResult, RESULT_SCHEMA, type AnalysisResult } from '../shared/result';

export type GeminiOutcome = (
  | { ok: true; result: AnalysisResult }
  | { ok: false; reason: 'invalid' | 'quota' | 'timeout' | 'blocked' | 'error' }
) & {
  httpStatus?: number;
  ms?: number;
  attempts?: number;
  detail?: string;
  thoughtChars?: number;
  /** Milliseconds until Gemini sent its first data chunk (undefined = never). */
  firstDataMs?: number;
  /** The model that produced this outcome. */
  model?: string;
  /** Set when the fallback model was tried, with why the primary failed. */
  fallbackFrom?: { model: string; reason: string; httpStatus?: number; firstDataMs?: number; thoughtChars?: number };
};

export interface GeminiOptions {
  apiKey: string;
  model: string;
  /** Sent as thinkingConfig.thinkingLevel only when set. */
  thinkingLevel?: string;
  /** Ask for thought summaries (default true). */
  includeThoughts?: boolean;
  /** Tried once if the main model times out, is out of quota, or errors. */
  fallbackModel?: string;
  /** Called just before switching to the fallback model. */
  onFallback?: () => void;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  fetchImpl?: typeof fetch;
  /** Give up when nothing arrives for this long. */
  idleTimeoutMs?: number;
  /** Give up after this long no matter what. */
  totalTimeoutMs?: number;
  /** Called with each piece of thought-summary text as it streams in. */
  onThought?: (text: string) => void;
  /** Called before the second attempt when the first answer was malformed. */
  onRetry?: () => void;
}

const BLOCK_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

interface Part {
  text?: string;
  thought?: boolean;
}
interface Chunk {
  promptFeedback?: { blockReason?: string };
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
}

async function streamOnce(o: GeminiOptions): Promise<GeminiOutcome> {
  const started = Date.now();
  const base = (o.baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const url = `${base}/v1beta/models/${encodeURIComponent(o.model)}:streamGenerateContent?alt=sse`;
  const doFetch = o.fetchImpl ?? fetch;
  const idleMs = o.idleTimeoutMs ?? CONFIG.geminiIdleTimeoutMs;
  const ctrl = new AbortController();
  let idle = setTimeout(() => ctrl.abort(), idleMs);
  const total = setTimeout(() => ctrl.abort(), o.totalTimeoutMs ?? CONFIG.geminiTotalTimeoutMs);
  const bump = () => {
    clearTimeout(idle);
    idle = setTimeout(() => ctrl.abort(), idleMs);
  };
  let firstDataMs: number | undefined;
  const done = (out: GeminiOutcome): GeminiOutcome => {
    clearTimeout(idle);
    clearTimeout(total);
    return { ...out, ms: Date.now() - started, firstDataMs, model: o.model };
  };

  let answer = '';
  let thoughtChars = 0;
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: o.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: o.userPrompt }] }],
        generationConfig: {
          // Gemini 3 models: keep the default temperature (lower values can loop).
          ...(o.includeThoughts === false && !o.thinkingLevel
            ? {}
            : {
                thinkingConfig: {
                  ...(o.includeThoughts === false ? {} : { includeThoughts: true }),
                  ...(o.thinkingLevel ? { thinkingLevel: o.thinkingLevel } : {}),
                },
              }),
          responseMimeType: 'application/json',
          responseSchema: RESULT_SCHEMA,
        },
      }),
      signal: ctrl.signal,
    });
    bump();
    if (res.status === 429) return done({ ok: false, reason: 'quota', httpStatus: 429 });
    if (!res.ok) return done({ ok: false, reason: 'error', httpStatus: res.status, detail: await errorDetail(res) });
    if (!res.body) return done({ ok: false, reason: 'invalid' });

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let blocked = false;
    const handle = (ev: string) => {
      const data = ev
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (!data) return;
      let chunk: Chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        return;
      }
      if (chunk.promptFeedback?.blockReason) blocked = true;
      const cand = chunk.candidates?.[0];
      if (cand?.finishReason && BLOCK_FINISH.has(cand.finishReason)) blocked = true;
      for (const p of cand?.content?.parts ?? []) {
        if (!p.text) continue;
        if (p.thought) {
          thoughtChars += p.text.length;
          o.onThought?.(p.text);
        } else answer += p.text;
      }
    };
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      bump();
      firstDataMs ??= Date.now() - started;
      buffer += value;
      // Server-sent events are separated by a blank line.
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      events.forEach(handle);
    }
    if (buffer.trim()) handle(buffer);
    if (blocked) return done({ ok: false, reason: 'blocked', thoughtChars });
  } catch (err) {
    const name = (err as Error)?.name;
    const timedOut = ctrl.signal.aborted || name === 'TimeoutError' || name === 'AbortError';
    return done({ ok: false, reason: timedOut ? 'timeout' : 'error', thoughtChars });
  }

  const result = parseResult(answer);
  return done(result ? { ok: true, result, thoughtChars } : { ok: false, reason: 'invalid', thoughtChars });
}

/**
 * Google's error text for a rejected request (e.g. "Invalid value at
 * 'generation_config.thinking_config'"). It describes the request's settings,
 * not the user's text. Trimmed so a log line stays small.
 */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { status?: string; message?: string } };
    return `${body.error?.status ?? ''} ${body.error?.message ?? ''}`.trim().slice(0, 300);
  } catch {
    return '';
  }
}

/** One model: malformed output is retried exactly once. */
async function withRetry(o: GeminiOptions): Promise<GeminiOutcome> {
  const first = await streamOnce(o);
  if (first.ok || first.reason !== 'invalid') return { ...first, attempts: 1 };
  o.onRetry?.();
  const second = await streamOnce(o);
  return { ...second, attempts: 2, ms: (first.ms ?? 0) + (second.ms ?? 0) };
}

/**
 * Calls the main model; if it times out, has no quota or errors, tries the
 * fallback model once (without thought summaries: lighter models may not
 * support them).
 */
export async function analyzeWithGemini(o: GeminiOptions): Promise<GeminiOutcome> {
  const primary = await withRetry(o);
  const canFallBack = !primary.ok && ['timeout', 'quota', 'error'].includes(primary.reason);
  if (!canFallBack || !o.fallbackModel || o.fallbackModel === o.model) return primary;
  o.onFallback?.();
  const fallback = await withRetry({ ...o, model: o.fallbackModel, thinkingLevel: undefined, includeThoughts: false });
  return {
    ...fallback,
    ms: (primary.ms ?? 0) + (fallback.ms ?? 0),
    fallbackFrom: {
      model: o.model,
      reason: primary.ok ? 'ok' : primary.reason,
      httpStatus: primary.httpStatus,
      firstDataMs: primary.firstDataMs,
      thoughtChars: primary.thoughtChars,
    },
  };
}
