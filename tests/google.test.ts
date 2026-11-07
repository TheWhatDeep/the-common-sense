import { beforeAll, describe, expect, it } from 'vitest';
import { verifyGoogleIdToken } from '../server/google';

const b64url = (data: string | Uint8Array) =>
  Buffer.from(typeof data === 'string' ? data : data).toString('base64url');

let keyPair: CryptoKeyPair;
let jwk: JsonWebKey;
const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = Date.parse('2026-11-07T00:00:00Z');

async function makeToken(payload: Record<string, unknown>, kid = 'k1') {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

const keysFetch = (async () =>
  new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }), {
    headers: { 'cache-control': 'max-age=0' },
  })) as unknown as typeof fetch;

const valid = {
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  sub: '1234567890',
  email: 'deep@example.com',
  email_verified: true,
  name: 'Deep',
  exp: NOW / 1000 + 3600,
};

beforeAll(async () => {
  keyPair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
});

describe('verifyGoogleIdToken', () => {
  it('accepts a correctly signed token for this client', async () => {
    const id = await verifyGoogleIdToken(await makeToken(valid), CLIENT, keysFetch, NOW);
    expect(id).toEqual({ sub: '1234567890', email: 'deep@example.com', name: 'Deep' });
  });

  it('rejects a tampered payload', async () => {
    const [h, , s] = (await makeToken(valid)).split('.');
    const forged = `${h}.${b64url(JSON.stringify({ ...valid, email: 'attacker@example.com' }))}.${s}`;
    expect(await verifyGoogleIdToken(forged, CLIENT, keysFetch, NOW)).toBeNull();
  });

  it('rejects the wrong audience, issuer, expiry or unverified email', async () => {
    for (const bad of [
      { aud: 'someone-else' },
      { iss: 'https://evil.example' },
      { exp: NOW / 1000 - 1 },
      { email_verified: false },
    ])
      expect(await verifyGoogleIdToken(await makeToken({ ...valid, ...bad }), CLIENT, keysFetch, NOW)).toBeNull();
  });

  it('rejects an unknown key id', async () => {
    expect(await verifyGoogleIdToken(await makeToken(valid, 'other'), CLIENT, keysFetch, NOW)).toBeNull();
  });
});
