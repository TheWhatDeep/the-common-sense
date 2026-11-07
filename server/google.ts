/**
 * Verifies a Google Identity Services ID token (a signed JWT) using Google's
 * public keys. No Google client library needed; Web Crypto does the RSA check.
 */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

let cachedKeys: { keys: JsonWebKey[]; expires: number } | null = null;

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function googleKeys(fetchImpl: typeof fetch): Promise<JsonWebKey[]> {
  if (cachedKeys && cachedKeys.expires > Date.now()) return cachedKeys.keys;
  const res = await fetchImpl(CERTS_URL);
  if (!res.ok) throw new Error('could not fetch Google keys');
  const body = (await res.json()) as { keys: JsonWebKey[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cachedKeys = { keys: body.keys, expires: Date.now() + maxAge * 1000 };
  return body.keys;
}

export async function verifyGoogleIdToken(
  token: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<GoogleIdentity | null> {
  const segments = token.split('.');
  if (segments.length !== 3 || !clientId) return null;
  try {
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(b64urlToBytes(segments[0])));
    const payload = JSON.parse(decoder.decode(b64urlToBytes(segments[1])));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    const jwk = (await googleKeys(fetchImpl)).find((k) => (k as { kid?: string }).kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(`${segments[0]}.${segments[1]}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(segments[2]), signed);
    if (!valid) return null;

    if (!ISSUERS.has(payload.iss)) return null;
    if (payload.aud !== clientId) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
    if (payload.email_verified !== true || typeof payload.email !== 'string' || typeof payload.sub !== 'string') return null;
    return { sub: payload.sub, email: payload.email, name: typeof payload.name === 'string' ? payload.name : '' };
  } catch {
    return null;
  }
}
