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
  deleteSituation: (id: string) => request<{ ok: true }>('DELETE', `/situations/${id}`),
};
