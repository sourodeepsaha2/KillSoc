import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { encryptToken, decryptToken } from './utils/crypto.js';
import { signAuthToken, JWT_COOKIE_NAME, OAUTH_STATE_COOKIE_NAME } from './utils/jwt.js';
import { JobQueueFactory } from './jobs/job-queue.factory.js';
import { MockJobQueue } from './jobs/mock-queue.service.js';
import { isRedisHealthy, closeRedisConnection } from './jobs/redis.connection.js';

let server: http.Server | undefined = undefined;
let baseUrl: string;

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
};

const runE2ETests = async () => {
  console.log('================================================================');
  console.log('🚀 KILLSOC — TASK 11: FULL-STACK INTEGRATION & E2E TEST SUITE');
  console.log('================================================================');

  // Intercept GitHub API requests for isolated determinism
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = String(input);
    if (!urlStr.includes('api.github.com')) {
      return originalFetch(input, init);
    }

    if (urlStr.includes('/community/profile')) {
      return new Response(
        JSON.stringify({
          health_percentage: 100,
          files: {
            readme: { url: 'https://api.github.com/readme' },
            contributing: { url: 'https://api.github.com/contributing' },
            license: { key: 'mit' },
            code_of_conduct: { key: 'contributor-covenant' }
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' } }
      );
    }

    if (urlStr.includes('/commits')) {
      return new Response(
        JSON.stringify([
          {
            sha: 'sha_test_1',
            commit: { message: 'feat: add feature', author: { date: new Date().toISOString() } },
            author: { login: 'dev_1' }
          }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' } }
      );
    }

    if (urlStr.includes('/contributors')) {
      return new Response(
        JSON.stringify([{ login: 'dev_1', contributions: 25 }]),
        { status: 200, headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' } }
      );
    }

    if (urlStr.includes('/issues')) {
      return new Response(
        JSON.stringify([
          {
            id: 9942,
            number: 42,
            title: 'Fix TypeScript typing for async handler',
            state: 'open',
            labels: [{ name: 'good first issue' }, { name: 'beginner' }],
            comments: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' } }
      );
    }

    return new Response(
      JSON.stringify({
        id: 999999,
        name: 'test-e2e-repo',
        full_name: 'test-e2e-owner/test-e2e-repo',
        description: 'Mock repo',
        html_url: 'https://github.com/test-e2e-owner/test-e2e-repo',
        language: 'TypeScript',
        stargazers_count: 1250,
        forks_count: 320,
        open_issues_count: 15,
        default_branch: 'main',
        archived: false,
        fork: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' } }
    );
  };

  // 1. Start ephemeral HTTP test server
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[E2E] Test server active at ${baseUrl}`);

  const redisHealthy = await isRedisHealthy();
  if (!redisHealthy) {
    console.log('[E2E] Redis offline - activating MockJobQueue for isolated test execution');
    JobQueueFactory.setCustomQueue(new MockJobQueue());
  } else {
    console.log('[E2E] Redis connected - testing against live BullMQ queue');
  }

  const testSuffix = Date.now().toString();

  // Test Users
  let userA: any;
  let userB: any;
  let adminUser: any;
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;

  try {
    console.log('\n--- 1. Security & Authentication Audit ---');

    // 1.1 OAuth Redirect & CSRF state cookie
    const authInitRes = await fetch(`${baseUrl}/api/auth/github`, { redirect: 'manual' });
    assert(authInitRes.status === 302, 'GET /api/auth/github initiates OAuth redirect (302)');
    const redirectUrl = authInitRes.headers.get('location') || '';
    assert(redirectUrl.startsWith('https://github.com/login/oauth/authorize?'), 'Redirects to official GitHub OAuth URL');
    assert(redirectUrl.includes('client_id='), 'Includes client_id parameter');
    assert(redirectUrl.includes('state='), 'Includes cryptographic state parameter');

    const setCookie = authInitRes.headers.get('set-cookie') || '';
    assert(setCookie.includes(OAUTH_STATE_COOKIE_NAME), 'Sets oauth_state cookie');
    assert(setCookie.includes('HttpOnly'), 'oauth_state is HttpOnly');

    // 1.2 Invalid OAuth state callback rejection
    const invalidStateRes = await fetch(`${baseUrl}/api/auth/github/callback?code=mock_code&state=forged_state_value`);
    assert(invalidStateRes.status === 400, 'Callback rejects forged OAuth state (400)');

    // 1.3 Create test users with encrypted tokens
    const sampleAccessTokenA = `gho_token_user_a_${testSuffix}`;
    const encryptedTokenA = encryptToken(sampleAccessTokenA, env.TOKEN_ENCRYPTION_KEY);

    userA = await prisma.user.create({
      data: {
        githubId: `gh_user_a_${testSuffix}`,
        githubUsername: `dev-a-${testSuffix}`,
        email: `dev-a-${testSuffix}@example.com`,
        encryptedAccessToken: encryptedTokenA.ciphertext,
        tokenIv: encryptedTokenA.iv,
        tokenTag: encryptedTokenA.tag,
        role: 'DEVELOPER'
      }
    });

    const sampleAccessTokenB = `gho_token_user_b_${testSuffix}`;
    const encryptedTokenB = encryptToken(sampleAccessTokenB, env.TOKEN_ENCRYPTION_KEY);

    userB = await prisma.user.create({
      data: {
        githubId: `gh_user_b_${testSuffix}`,
        githubUsername: `dev-b-${testSuffix}`,
        email: `dev-b-${testSuffix}@example.com`,
        encryptedAccessToken: encryptedTokenB.ciphertext,
        tokenIv: encryptedTokenB.iv,
        tokenTag: encryptedTokenB.tag,
        role: 'DEVELOPER'
      }
    });

    adminUser = await prisma.user.create({
      data: {
        githubId: `gh_admin_${testSuffix}`,
        githubUsername: `admin-${testSuffix}`,
        email: `admin-${testSuffix}@example.com`,
        encryptedAccessToken: encryptedTokenA.ciphertext,
        tokenIv: encryptedTokenA.iv,
        tokenTag: encryptedTokenA.tag,
        role: 'ADMIN'
      }
    });

    tokenA = signAuthToken({ userId: userA.id, githubId: userA.githubId, username: userA.githubUsername });
    tokenB = signAuthToken({ userId: userB.id, githubId: userB.githubId, username: userB.githubUsername });
    adminToken = signAuthToken({ userId: adminUser.id, githubId: adminUser.githubId, username: adminUser.githubUsername });

    // 1.4 Test Token Encryption at Rest
    const dbRecordA = await prisma.user.findUnique({ where: { id: userA.id } });
    assert(dbRecordA?.encryptedAccessToken !== sampleAccessTokenA, 'Plaintext token never stored in PostgreSQL');
    const decryptedA = decryptToken({
      ciphertext: dbRecordA!.encryptedAccessToken!,
      iv: dbRecordA!.tokenIv!,
      tag: dbRecordA!.tokenTag!
    }, env.TOKEN_ENCRYPTION_KEY);
    assert(decryptedA === sampleAccessTokenA, 'AES-256-GCM token decrypts seamlessly in-memory');

    // 1.5 Session Restoration & Zero Secret Leakage via /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(meRes.status === 200, 'GET /api/auth/me succeeds with valid JWT cookie');
    const meJson = await meRes.json();
    assert(meJson.success === true, 'Returns success: true');
    assert(meJson.data.githubUsername === userA.githubUsername, 'Returns correct authenticated username');
    assert(!meJson.data.encryptedAccessToken && !meJson.data.tokenIv, 'Zero encrypted secrets leaked in /api/auth/me payload');

    // 1.6 Admin RBAC protection test
    const unauthImportRes = await fetch(`${baseUrl}/api/discovery/organizations/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenA}` },
      body: JSON.stringify({ organizations: [] })
    });
    assert(unauthImportRes.status === 403, 'Admin endpoint rejects DEVELOPER role with HTTP 403 Forbidden');

    const authImportRes = await fetch(`${baseUrl}/api/discovery/organizations/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${adminToken}` },
      body: JSON.stringify({
        organizations: [
          {
            name: `Test E2E Org ${testSuffix}`,
            slug: `test-e2e-org-${testSuffix}`,
            description: 'Organization created for end-to-end integration test',
            website: 'https://e2e.example.org',
            category: 'Operating Systems',
            year: 2024,
            topics: ['TypeScript', 'Rust', 'Linux']
          }
        ]
      })
    });
    assert(authImportRes.status === 200, 'Admin endpoint accepts ADMIN role with HTTP 200 OK');

    console.log('\n--- 2. End-to-End Journey A: Developer Profile & Skill Setup ---');

    // Add skills for User A
    const addSkillRes = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenA}` },
      body: JSON.stringify({ skillName: 'TypeScript', proficiency: 'Advanced' })
    });
    assert(addSkillRes.status === 201, 'POST /api/skills creates skill with HTTP 201');
    const skillJson = await addSkillRes.json();
    assert(skillJson.data.skillName === 'TypeScript', 'Skill normalized correctly to TypeScript');
    assert(skillJson.data.proficiency === 'Advanced', 'Proficiency stored as Advanced');

    // Bulk update skills
    const bulkSkillRes = await fetch(`${baseUrl}/api/skills/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenA}` },
      body: JSON.stringify({
        skills: [
          { skillName: 'TypeScript', proficiency: 'Advanced' },
          { skillName: 'React', proficiency: 'Intermediate' },
          { skillName: 'PostgreSQL', proficiency: 'Intermediate' }
        ]
      })
    });
    assert(bulkSkillRes.status === 200, 'PUT /api/skills/bulk updates skills');
    const bulkJson = await bulkSkillRes.json();
    assert(bulkJson.data.length === 3, 'User A registered exactly 3 skills');

    // User Data Isolation: User B cannot access User A skills
    const userASkillId = skillJson.data.id;
    const userBAccessSkillRes = await fetch(`${baseUrl}/api/skills/${userASkillId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenB}` },
      body: JSON.stringify({ proficiency: 'Beginner' })
    });
    assert(userBAccessSkillRes.status === 404, 'USER ISOLATION: User B blocked from modifying User A skill (404 Not Found)');

    console.log('\n--- 3. End-to-End Journey B: GSoC Organization Discovery ---');

    // Browse organizations
    const orgsRes = await fetch(`${baseUrl}/api/discovery/organizations?search=test-e2e-org-${testSuffix}`);
    assert(orgsRes.status === 200, 'GET /api/discovery/organizations is publicly accessible (200)');
    const orgsJson = await orgsRes.json();
    assert(orgsJson.data.length >= 1, 'Discovered imported test organization');

    // Inspect organization detail
    const orgSlug = `test-e2e-org-${testSuffix}`;
    const orgDetailRes = await fetch(`${baseUrl}/api/discovery/organizations/${orgSlug}`);
    assert(orgDetailRes.status === 200, 'GET /api/discovery/organizations/:slug returns detail (200)');
    const orgDetailJson = await orgDetailRes.json();
    assert(orgDetailJson.data.slug === orgSlug, 'Organization slug matches target');
    assert(Array.isArray(orgDetailJson.data.years), 'Includes GSoC participation years');

    // Create a mock repository and issue for this organization to test downstream journeys
    const testOrgRecord = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    const repoFullName = `test-e2e-owner/test-e2e-repo-${testSuffix}`;

    const testRepo = await prisma.repository.create({
      data: {
        organization: { connect: { id: testOrgRecord!.id } },
        githubRepoId: `repo_${testSuffix}`,
        name: `test-e2e-repo-${testSuffix}`,
        fullName: repoFullName,
        description: 'Mock repository for end-to-end intelligence and contribution testing',
        language: 'TypeScript',
        stars: 1250,
        forks: 320,
        openIssues: 15,
        topics: ['typescript', 'react', 'gsoc'],
        extractedSkills: ['TypeScript', 'React', 'Node.js']
      }
    });

    const testIssue = await prisma.issue.create({
      data: {
        repository: { connect: { id: testRepo.id } },
        githubIssueId: `issue_${testSuffix}`,
        number: 42,
        title: 'Fix TypeScript typing for async handler',
        description: 'We need to correct the typing definition in src/handler.ts.',
        url: `https://github.com/${repoFullName}/issues/42`,
        state: 'open',
        labels: ['good first issue', 'typescript', 'beginner'],
        isBeginnerFriendly: true,
        matchingLabels: ['good first issue', 'beginner'],
        commentsCount: 2
      }
    });
    assert(Boolean(testIssue.id), 'Test issue created in PostgreSQL');

    // Query organization repos
    const orgReposRes = await fetch(`${baseUrl}/api/discovery/organizations/${orgSlug}/repos`);
    assert(orgReposRes.status === 200, 'GET /api/discovery/organizations/:slug/repos returns repos');
    const orgReposJson = await orgReposRes.json();
    const reposList = Array.isArray(orgReposJson.data)
      ? orgReposJson.data
      : Array.isArray(orgReposJson.data?.repositories)
      ? orgReposJson.data.repositories
      : [];
    assert(reposList.length >= 1, 'Discovered repository under organization');

    console.log('\n--- 4. End-to-End Journey C: Repository Intelligence Engine ---');

    // Query intelligence analysis (or calculate if unanalyzed)
    const [owner, repoName] = repoFullName.split('/');
    const analysisRes = await fetch(`${baseUrl}/api/intelligence/repos/${owner}/${repoName}`);
    assert(analysisRes.status === 200, 'GET /api/intelligence/repos/:owner/:repo returns analysis');
    const analysisJson = await analysisRes.json();
    assert(typeof analysisJson.data.scores.overall === 'number', 'Calculated overall score');
    assert(typeof analysisJson.data.scores.activity === 'number', 'Calculated activity score');
    assert(typeof analysisJson.data.scores.documentation === 'number', 'Calculated documentation score');
    assert(typeof analysisJson.data.scores.beginner === 'number', 'Calculated beginner score');
    assert(analysisJson.data.scores.overall >= 0 && analysisJson.data.scores.overall <= 100, 'Score is bounded between 0 and 100');
    assert(Array.isArray(analysisJson.data.explanations.overall), 'Explainability strengths attached');

    // Both /analyze and /refresh endpoints work
    const analyzeTriggerRes = await fetch(`${baseUrl}/api/intelligence/repos/${owner}/${repoName}/analyze`, {
      method: 'POST'
    });
    assert(analyzeTriggerRes.status === 200, 'POST /intelligence/repos/:owner/:repo/analyze refreshes analysis');

    const refreshTriggerRes = await fetch(`${baseUrl}/api/intelligence/repos/${owner}/${repoName}/refresh`, {
      method: 'POST'
    });
    assert(refreshTriggerRes.status === 200, 'POST /intelligence/repos/:owner/:repo/refresh alias endpoint functions seamlessly');

    console.log('\n--- 5. End-to-End Journey D: Developer Skill Matching Engine ---');

    // Generate deterministic matches for User A
    const matchGenRes = await fetch(`${baseUrl}/api/matching/generate`, {
      method: 'POST',
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(matchGenRes.status === 200, 'POST /api/matching/generate generates recommendations');
    const matchGenJson = await matchGenRes.json();
    assert(Array.isArray(matchGenJson.data), 'Returns matching recommendations array');

    // Retrieve user recommendations
    const matchesRes = await fetch(`${baseUrl}/api/matching/recommendations`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(matchesRes.status === 200, 'GET /api/matching/recommendations returns user recommendations');
    const matchesJson = await matchesRes.json();
    assert(matchesJson.data.length > 0, 'Found recommendation matching User A TypeScript skill');
    const firstMatch = matchesJson.data[0];
    assert(firstMatch.matchedSkills.includes('TypeScript'), 'TypeScript successfully matched');

    // User isolation on match detail
    const matchDetailRes = await fetch(`${baseUrl}/api/matching/recommendations/${firstMatch.id}`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(matchDetailRes.status === 200, 'GET /api/matching/recommendations/:id returns detail for owner');

    const userBUnauthorizedMatchRes = await fetch(`${baseUrl}/api/matching/recommendations/${firstMatch.id}`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenB}` }
    });
    assert(userBUnauthorizedMatchRes.status === 404, 'USER ISOLATION: User B blocked from viewing User A match recommendation');

    console.log('\n--- 6. End-to-End Journey E: Contribution Opportunity Discovery ---');

    // Browse open issues
    const issuesRes = await fetch(`${baseUrl}/api/discovery/issues?beginnerOnly=true`);
    assert(issuesRes.status === 200, 'GET /api/discovery/issues returns issues list');
    const issuesJson = await issuesRes.json();
    assert(issuesJson.data.length >= 1, 'Discovered beginner-friendly issues');
    assert(issuesJson.data[0].isBeginnerFriendly === true, 'Issue marked as beginner friendly');
    assert(issuesJson.data[0].gsocSuitabilityDisclaimer.length > 0, 'Mandatory GSoC Suitability Disclaimer present');

    // Query issue detail
    const issueDetailRes = await fetch(`${baseUrl}/api/discovery/issues/${owner}/${repoName}/42`);
    assert(issueDetailRes.status === 200, 'GET /api/discovery/issues/:owner/:repo/:issueNumber returns detail');
    const issueDetailJson = await issueDetailRes.json();
    assert(issueDetailJson.data.number === 42, 'Returns requested issue number 42');
    assert(issueDetailJson.data.title.includes('Fix TypeScript typing'), 'Returns issue title');

    console.log('\n--- 7. End-to-End Journey F: AI-Powered Recommendations ---');

    // Generate AI recommendations
    const aiGenRes = await fetch(`${baseUrl}/api/ai/recommendations/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenA}` },
      body: JSON.stringify({ forceRefresh: true, maxRepositories: 3 })
    });
    assert(aiGenRes.status === 200, 'POST /api/ai/recommendations/generate succeeds');
    const aiGenJson = await aiGenRes.json();
    assert(aiGenJson.data.length > 0, 'Generated grounded recommendations');

    const firstAiRec = aiGenJson.data[0];
    assert(firstAiRec.sources.repositoryFullName.length > 0, 'Sources cite verified repository');
    assert(Array.isArray(firstAiRec.checklist), 'Actionable checklist attached');
    assert(Array.isArray(firstAiRec.maintainerQuestions), 'Maintainer inquiry questions attached');

    // Query AI recommendations list
    const aiListRes = await fetch(`${baseUrl}/api/ai/recommendations`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(aiListRes.status === 200, 'GET /api/ai/recommendations returns list');

    // Refresh single recommendation
    const aiRefreshRes = await fetch(`${baseUrl}/api/ai/recommendations/${firstAiRec.id}/refresh`, {
      method: 'POST',
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(aiRefreshRes.status === 200, 'POST /api/ai/recommendations/:id/refresh refreshes reasoning');

    // User isolation on AI recommendations
    const userBUnauthorizedAiRes = await fetch(`${baseUrl}/api/ai/recommendations/${firstAiRec.id}`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenB}` }
    });
    assert(userBUnauthorizedAiRes.status === 404, 'USER ISOLATION: User B blocked from viewing User A AI recommendation');

    console.log('\n--- 8. End-to-End Journey G: Asynchronous Redis + BullMQ Background Jobs ---');

    // Enqueue organization sync job
    const enqueueOrgJobRes = await fetch(`${baseUrl}/api/jobs/organizations/${orgSlug}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenA}` },
      body: JSON.stringify({ force: true })
    });
    assert(enqueueOrgJobRes.status === 202, 'POST /api/jobs/organizations/:slug/sync returns HTTP 202 Accepted');
    const orgJobJson = await enqueueOrgJobRes.json();
    const orgJobId = orgJobJson.data.jobId;
    assert(Boolean(orgJobId), 'Returns BullMQ Job ID');

    // Enqueue repository analysis job
    const enqueueRepoJobRes = await fetch(`${baseUrl}/api/jobs/repos/${owner}/${repoName}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenA}` },
      body: JSON.stringify({ forceRefresh: true })
    });
    assert(enqueueRepoJobRes.status === 202, 'POST /api/jobs/repos/:owner/:repo/analyze returns HTTP 202 Accepted');
    const repoJobJson = await enqueueRepoJobRes.json();
    const repoJobId = repoJobJson.data.jobId;
    assert(Boolean(repoJobId), 'Returns repository analysis Job ID');

    // Enqueue AI recommendations job
    const enqueueAiJobRes = await fetch(`${baseUrl}/api/jobs/recommendations/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(enqueueAiJobRes.status === 202, 'POST /api/jobs/recommendations/generate returns HTTP 202 Accepted');

    // Poll job status
    const pollJobRes = await fetch(`${baseUrl}/api/jobs/${orgJobId}`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(pollJobRes.status === 200, 'GET /api/jobs/:jobId returns job status');
    const pollJson = await pollJobRes.json();
    assert(pollJson.data.jobId === orgJobId, 'Job ID matches query');
    assert(['waiting', 'active', 'completed', 'failed', 'delayed'].includes(pollJson.data.status), 'Status is valid BullMQ state');

    // User isolation on jobs: User B cannot query User A job status
    const userBJobPollRes = await fetch(`${baseUrl}/api/jobs/${orgJobId}`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenB}` }
    });
    assert(userBJobPollRes.status === 404, 'USER ISOLATION: User B blocked from polling User A job status (404 Not Found)');

    // Logout test
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `${JWT_COOKIE_NAME}=${tokenA}` }
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout clears auth session');
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';
    assert(logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires='), 'auth_token cookie cleared on logout');

    console.log('\n--- 9. Cleanup Test Fixtures ---');
    await prisma.issue.deleteMany({ where: { repositoryId: testRepo.id } });
    await prisma.repositoryAnalysis.deleteMany({ where: { repositoryId: testRepo.id } });
    await prisma.recommendation.deleteMany({ where: { repositoryId: testRepo.id } });
    await prisma.aiRecommendation.deleteMany({ where: { userId: userA.id } });
    await prisma.repository.deleteMany({ where: { organizationId: testOrgRecord!.id } });
    await prisma.organization.deleteMany({ where: { id: testOrgRecord!.id } });
    await prisma.developerSkill.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id, adminUser.id] } } });
    console.log('  ✓ Cleaned up test organizations, repositories, issues, and test users from PostgreSQL');

    console.log('\n================================================================');
    console.log('🎉 ALL END-TO-END JOURNEYS AND SECURITY AUDITS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');
  } finally {
    globalThis.fetch = originalFetch;
    if (server) {
      server.close();
    }
    await closeRedisConnection();
    await prisma.$disconnect();
    process.exit(0);
  }
};

runE2ETests().catch((err) => {
  console.error('\n❌ E2E TEST SUITE RUNTIME FAILURE:\n', err);
  if (server) server.close();
  closeRedisConnection().finally(() => {
    prisma.$disconnect().finally(() => process.exit(1));
  });
});
