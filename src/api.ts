import type { Answers } from '../shared/questionBank';
import type { AnalysisResult } from '../shared/result';

export interface Usage {
  used: number;
  cap: number;
  remaining: number;
  resetsAt: string;
}

export interface Me {
  user: { id: string; email: string; displayName: string };
  disclosureAccepted: boolean;
  usage: Usage;
}

export type Status = 'draft' | 'answered' | 'analyzed';

export interface Situation {
  id: string;
  text: string;
  status: Status;
  saved: boolean;
  bankVersion: number;
  createdAt: string;
  updatedAt: string;
  answers: Answers;
  result: (AnalysisResult & { model: string; createdAt: string }) | null;
}

export interface SituationSummary {
  id: string;
  text: string;
  status: Status;
  saved: boolean;
  savedAt: string | null;
  /** For drafts: the interview step (2-5) to resume at. */
  step: number | null;
  createdAt: string;
  updatedAt: string;
  bottomLine: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = (err as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') throw new ApiError(0, 'timeout', 'That took too long. Try again.');
    throw new ApiError(0, 'offline', "Can't reach the server. Check your connection.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? 'error'), String(data.message ?? 'Something went wrong.'), data);
  }
  return data as T;
}

export const api = {
  authConfig: () => request<{ googleClientId: string; devLogin: boolean }>('GET', '/auth/config'),
  signIn: (credential: string) => request<Me>('POST', '/auth/sign-in', { credential }),
  devSignIn: (email: string, name: string) => request<Me>('POST', '/auth/dev-sign-in', { email, name }),
  signOut: () => request<{ ok: true }>('POST', '/auth/sign-out'),
  me: () => request<Me>('GET', '/me'),
  acceptDisclosure: () => request<Me>('POST', '/me/disclosure'),
  deleteAccount: () => request<{ ok: true }>('DELETE', '/me'),
  createSituation: (text: string) => request<Situation>('POST', '/situations', { text }),
  listSituations: () => request<{ situations: SituationSummary[] }>('GET', '/situations'),
  getSituation: (id: string) => request<Situation>('GET', `/situations/${id}`),
  updateText: (id: string, text: string) => request<Situation>('PATCH', `/situations/${id}`, { text }),
  saveAnswers: (id: string, answers: Answers) => request<Situation>('PUT', `/situations/${id}/answers`, { answers }),
  // Server waits up to 30 s per Gemini call and may retry once on bad output.
  analyze: (id: string) => request<Situation>('POST', `/situations/${id}/analyze`, undefined, 70_000),
  setSaved: (id: string, saved: boolean) => request<Situation>('PUT', `/situations/${id}/saved`, { saved }),
  deleteSituation: (id: string) => request<{ ok: true }>('DELETE', `/situations/${id}`),
};

/**
 * Runs the analysis as a stream: thought summaries arrive through onThought
 * while Gemini works, then the stored situation (with its result) is returned.
 * The server enforces the timeouts; this only fails if the connection drops.
 */
export async function analyzeStream(
  id: string,
  handlers: { onThought?: (text: string) => void; onRetry?: () => void },
): Promise<Situation> {
  let res: Response;
  try {
    res = await fetch(`/api/situations/${id}/analyze`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'text/event-stream' },
    });
  } catch {
    throw new ApiError(0, 'offline', "Can't reach the server. Check your connection.");
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new ApiError(res.status, String(data.error ?? 'error'), String(data.message ?? 'Something went wrong.'), data);
    return data as unknown as Situation; // already analyzed
  }

  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    let chunk: ReadableStreamReadResult<string>;
    try {
      chunk = await reader.read();
    } catch {
      break;
    }
    if (chunk.done) break;
    buffer += chunk.value;
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const raw = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || raw === undefined) continue;
      const data = JSON.parse(raw);
      if (event === 'thought') handlers.onThought?.(data.text);
      else if (event === 'retry') handlers.onRetry?.();
      else if (event === 'result') return data as Situation;
      else if (event === 'error') throw new ApiError(data.status ?? 500, data.error ?? 'error', data.message ?? 'Something went wrong.', data);
    }
  }
  throw new ApiError(0, 'connection_lost', 'The connection dropped. If the read finished, it’s saved; try again to see it.');
}
