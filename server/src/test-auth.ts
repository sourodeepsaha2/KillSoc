import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import {
  encryptToken,
  decryptToken,
  generateOAuthState,
  validateOAuthState
} from './utils/crypto.js';
import {
  signAuthToken,
  verifyAuthToken,
  JWT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME
} from './utils/jwt.js';

let server: http.Server | undefined = undefined;
let baseUrl: string;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
};

const runTests = async () => {
  console.log('\n--- 1. Testing Crypto & AES-256-GCM Utilities ---');
  const sampleToken = 'gho_9876543210fedcba_sample_secret_token';
  const encrypted = encryptToken(sampleToken, env.TOKEN_ENCRYPTION_KEY);
  
  assert(encrypted.ciphertext.length > 0, 'Ciphertext was generated');
  assert(encrypted.iv.length === 24, 'IV is 12 bytes (24 hex characters)');
  assert(encrypted.tag.length === 32, 'Auth tag is 16 bytes (32 hex characters)');
  assert(encrypted.ciphertext !== sampleToken, 'Ciphertext does not contain raw token');

  const decrypted = decryptToken(encrypted, env.TOKEN_ENCRYPTION_KEY);
  assert(decrypted === sampleToken, 'Decrypted token matches original sample token');

  // Verify tampering detection
  let tamperDetected = false;
  try {
    const tampered = { ...encrypted, tag: '00'.repeat(16) };
    decryptToken(tampered, env.TOKEN_ENCRYPTION_KEY);
  } catch {
    tamperDetected = true;
  }
  assert(tamperDetected, 'Tampered authentication tag is rejected by AES-256-GCM');

  // OAuth State generation & timing-safe validation
  const state1 = generateOAuthState();
  const state2 = generateOAuthState();
  assert(state1.length === 64, 'OAuth state is 32 random bytes (64 hex characters)');
  assert(validateOAuthState(state1, state1), 'Identical OAuth state passes validation');
  assert(!validateOAuthState(state1, state2), 'Different OAuth state fails validation');
  assert(!validateOAuthState(state1, undefined), 'Undefined state fails validation');
  assert(!validateOAuthState(state1, 'short'), 'Different length state fails validation safely');

  console.log('\n--- 2. Testing JWT Utilities ---');
  const mockPayload = {
    userId: '11111111-2222-3333-4444-555555555555',
    githubId: '999999',
    username: 'testdeveloper'
  };

  const token = signAuthToken(mockPayload);
  assert(typeof token === 'string' && token.split('.').length === 3, 'Valid JWT structure generated');

  const decoded = verifyAuthToken(token);
  assert(decoded.userId === mockPayload.userId, 'JWT decodes correct userId');
  assert(decoded.githubId === mockPayload.githubId, 'JWT decodes correct githubId');
  assert(decoded.username === mockPayload.username, 'JWT decodes correct username');

  let invalidJwtRejected = false;
  try {
    verifyAuthToken('invalid.token.here');
  } catch {
    invalidJwtRejected = true;
  }
  assert(invalidJwtRejected, 'Malformed JWT is rejected');

  console.log('\n--- 3. Testing Express HTTP Endpoints ---');
  // Start ephemeral server on random available port
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Test server running at ${baseUrl}`);

  // Test 3.1: GET /api/auth/github redirect
  const authRedirectRes = await fetch(`${baseUrl}/api/auth/github`, {
    redirect: 'manual'
  });
  assert(authRedirectRes.status === 302, 'GET /api/auth/github returns HTTP 302 Redirect');
  const location = authRedirectRes.headers.get('location') || '';
  assert(location.startsWith('https://github.com/login/oauth/authorize?'), 'Redirects to official GitHub authorization endpoint');
  assert(location.includes('scope=read%3Auser+user%3Aemail') || location.includes('scope=read%3Auser%20user%3Aemail'), 'Requests read:user and user:email scopes');
  assert(location.includes('state='), 'Includes OAuth state in redirect URL');
  
  const setCookie = authRedirectRes.headers.get('set-cookie') || '';
  assert(setCookie.includes(OAUTH_STATE_COOKIE_NAME), 'Sets oauth_state cookie for CSRF validation');
  assert(setCookie.includes('HttpOnly'), 'oauth_state cookie is HttpOnly');

  // Test 3.2: GET /api/auth/github/callback with missing/invalid state
  const invalidStateRes = await fetch(`${baseUrl}/api/auth/github/callback?code=mock_code&state=invalid_state`);
  assert(invalidStateRes.status === 400, 'Callback rejects invalid state with HTTP 400');
  const invalidStateBody = await invalidStateRes.json() as { success: boolean; error: { message: string } };
  assert(invalidStateBody.success === false, 'Returns JSON error format for invalid state');

  // Test 3.3: GET /api/auth/me without authentication
  const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
  assert(unauthRes.status === 401, 'GET /api/auth/me returns HTTP 401 when unauthenticated');
  const unauthBody = await unauthRes.json() as { success: boolean; error: { statusCode: number } };
  assert(unauthBody.error.statusCode === 401, 'Returns 401 error payload');

  // Test 3.4: GET /api/auth/me with invalid token cookie
  const badTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Cookie: `${JWT_COOKIE_NAME}=bad_jwt_token;`
    }
  });
  assert(badTokenRes.status === 401, 'GET /api/auth/me rejects invalid cookie token with HTTP 401');

  console.log('\n--- 4. Testing PostgreSQL User Persistence & /api/auth/me ---');
  // Create or update a test user directly in PostgreSQL with encrypted access token
  const testGithubId = 'test_gh_' + Date.now();
  const testAccessToken = 'gho_real_mock_access_token_' + Date.now();
  const enc = encryptToken(testAccessToken, env.TOKEN_ENCRYPTION_KEY);

  const testUser = await prisma.user.upsert({
    where: { githubId: testGithubId },
    update: {
      githubUsername: 'octocat_test',
      email: 'octocat@github.test',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      encryptedAccessToken: enc.ciphertext,
      tokenIv: enc.iv,
      tokenTag: enc.tag
    },
    create: {
      githubId: testGithubId,
      githubUsername: 'octocat_test',
      email: 'octocat@github.test',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      encryptedAccessToken: enc.ciphertext,
      tokenIv: enc.iv,
      tokenTag: enc.tag
    }
  });

  assert(testUser.id !== undefined, 'User persisted in PostgreSQL database');
  assert(testUser.encryptedAccessToken === enc.ciphertext, 'Encrypted token stored in PostgreSQL (not plaintext)');
  assert(testUser.tokenIv === enc.iv, 'Token IV stored in PostgreSQL');
  assert(testUser.tokenTag === enc.tag, 'Token auth tag stored in PostgreSQL');

  // Decrypt token from DB and verify
  const restoredToken = decryptToken(
    {
      ciphertext: testUser.encryptedAccessToken!,
      iv: testUser.tokenIv!,
      tag: testUser.tokenTag!
    },
    env.TOKEN_ENCRYPTION_KEY
  );
  assert(restoredToken === testAccessToken, 'Retrieved token decrypts to original plaintext');

  // Test 4.2: GET /api/auth/me with valid user session
  const validUserToken = signAuthToken({
    userId: testUser.id,
    githubId: testUser.githubId,
    username: testUser.githubUsername
  });

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Cookie: `${JWT_COOKIE_NAME}=${validUserToken};`
    }
  });

  assert(meRes.status === 200, 'GET /api/auth/me returns HTTP 200 for authenticated user');
  const meBody = await meRes.json() as {
    success: boolean;
    data: Record<string, unknown>;
  };
  assert(meBody.success === true, 'Returns success: true');
  assert(meBody.data['id'] === testUser.id, 'Returns correct user id');
  assert(meBody.data['githubId'] === testUser.githubId, 'Returns correct githubId');
  assert(meBody.data['githubUsername'] === 'octocat_test', 'Returns correct githubUsername');
  assert(meBody.data['email'] === 'octocat@github.test', 'Returns correct email');
  assert(meBody.data['encryptedAccessToken'] === undefined, 'Does NOT expose encryptedAccessToken in API response');
  assert(meBody.data['tokenIv'] === undefined, 'Does NOT expose tokenIv in API response');
  assert(meBody.data['tokenTag'] === undefined, 'Does NOT expose tokenTag in API response');

  // Test 4.3: POST /api/auth/logout
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: `${JWT_COOKIE_NAME}=${validUserToken};`
    }
  });

  assert(logoutRes.status === 200, 'POST /api/auth/logout returns HTTP 200');
  const logoutBody = await logoutRes.json() as { success: boolean; message: string };
  assert(logoutBody.success === true && logoutBody.message === 'Logged out successfully', 'Returns logout success message');
  const logoutCookie = logoutRes.headers.get('set-cookie') || '';
  assert(logoutCookie.includes(`${JWT_COOKIE_NAME}=;`), 'Clears auth_token cookie');
  assert(logoutCookie.includes('Expires=Thu, 01 Jan 1970') || logoutCookie.includes('Max-Age=0'), 'Sets expiration in past / Max-Age=0');

  // Clean up test user
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log('  ✓ Cleaned up test user from PostgreSQL');

  console.log('\n🎉 ALL 12 VERIFICATION CHECKS PASSED!\n');
};

try {
  await runTests();
} catch (err) {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
} finally {
  if (server) {
    (server as http.Server).close();
  }
  await prisma.$disconnect();
}
