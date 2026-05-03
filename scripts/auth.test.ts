import assert from 'node:assert/strict';
import { issueSession, verifySession, getCredential, verifyApiKey, sessionCookie, clearCookie } from '../lib/auth';

// Set env vars before calling auth functions (functions read them lazily, not at module init)
process.env.SESSION_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
process.env.OPENCLAW_API_KEY = 'test-api-key-12345';
process.env.PASSKEY_CREDENTIAL = JSON.stringify({ id: 'cred-id-abc', publicKey: 'pubkey-xyz', counter: 0 });

function fakeReq(auth?: string): Request {
  return { headers: { get: (h: string) => (h === 'authorization' ? (auth ?? null) : null) } } as unknown as Request;
}

// verifyApiKey
assert.equal(verifyApiKey(fakeReq('Bearer test-api-key-12345')), true, 'valid API key should pass');
assert.equal(verifyApiKey(fakeReq('Bearer wrong-key')), false, 'wrong key should fail');
assert.equal(verifyApiKey(fakeReq()), false, 'missing key should fail');

// issueSession + verifySession
const token = await issueSession();
assert.equal(typeof token, 'string', 'issueSession should return string');
assert.ok(token.split('.').length === 3, 'token should be a 3-part JWT');
assert.equal(await verifySession(token), true, 'fresh token should verify');
assert.equal(await verifySession('bad.jwt.token'), false, 'invalid token should not verify');
assert.equal(await verifySession(''), false, 'empty string should not verify');

// getCredential
const cred = getCredential();
assert.deepEqual(cred, { id: 'cred-id-abc', publicKey: 'pubkey-xyz', counter: 0 }, 'getCredential should parse env var JSON');

// sessionCookie
const cookie = sessionCookie(token);
assert.ok(cookie.startsWith('session='), 'cookie should start with session=');
assert.ok(cookie.includes('HttpOnly'), 'cookie should be HttpOnly');
assert.ok(cookie.includes('SameSite=Strict'), 'cookie should have SameSite=Strict');
assert.ok(cookie.includes('Max-Age=604800'), 'cookie should have 7-day max-age');

// clearCookie
assert.ok(clearCookie.startsWith('session='), 'clearCookie should target session cookie');
assert.ok(clearCookie.includes('Max-Age=0'), 'clearCookie should expire immediately');

console.log('✓ All auth assertions passed');
