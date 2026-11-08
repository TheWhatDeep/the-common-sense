/**
 * The one place the app talks to Gemini. The API key goes in a header and is
 * never logged, echoed or returned.
 */
import { CONFIG } from '../shared/config';
import { parseResult, RESULT_SCHEMA, type AnalysisResult } from '../shared/result';

export type GeminiOutcome = (
  | { ok: true; result: AnalysisResult }
  | { ok: false; reason: 'invalid' | 'quota' | 'timeout' | 'blocked' | 'error' }
) & { httpStatus?: number; ms?: number; attempts?: number };

export interface GeminiOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const BLOCK_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

async function callOnce(o: GeminiOptions): Promise<GeminiOutcome> {
  const started = Date.now();
  const out = await callOnceInner(o);
  return { ...out, ms: Date.now() - started };
}

async function callOnceInner(o: GeminiOptions): Promise<GeminiOutcome> {
  const base = (o.baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const url = `${base}/v1beta/models/${encodeURIComponent(o.model)}:generateContent`;
  const doFetch = o.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: o.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: o.userPrompt }] }],
        generationConfig: {
          // Gemini 3 models: keep the default temperature (lower values can loop),
          // and keep thinking short; this is a short structured answer.
          thinkingConfig: { thinkingLevel: 'low' },
          responseMimeType: 'application/json',
          responseSchema: RESULT_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(o.timeoutMs ?? CONFIG.geminiTimeoutMs),
    });
  } catch (err) {
    const name = (err as Error)?.name;
    return { ok: false, reason: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'error' };
  }

  if (res.status === 429) return { ok: false, reason: 'quota', httpStatus: 429 };
  if (!res.ok) return { ok: false, reason: 'error', httpStatus: res.status };

  let body: any;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (body?.promptFeedback?.blockReason) return { ok: false, reason: 'blocked' };
  const candidate = body?.candidates?.[0];
  if (!candidate) return { ok: false, reason: 'blocked' };
  if (BLOCK_FINISH.has(candidate.finishReason)) return { ok: false, reason: 'blocked' };

  // Skip any thought-summary parts; only the answer parts hold the JSON.
  const text = (candidate.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '')
    .join('');
  const result = parseResult(text);
  return result ? { ok: true, result } : { ok: false, reason: 'invalid' };
}

/** Calls Gemini; malformed output is retried exactly once. */
export async function analyzeWithGemini(o: GeminiOptions): Promise<GeminiOutcome> {
  const first = await callOnce(o);
  if (first.ok || first.reason !== 'invalid') return { ...first, attempts: 1 };
  const second = await callOnce(o);
  return { ...second, attempts: 2, ms: (first.ms ?? 0) + (second.ms ?? 0) };
}
