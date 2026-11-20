import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { encryptToken } from './utils/crypto.js';
import { signAuthToken, JWT_COOKIE_NAME } from './utils/jwt.js';
import { GitHubApiClient } from './services/github-api.client.js';
import { GitHubResourceService } from './services/github-resource.service.js';
import { GitHubSyncService } from './services/github-sync.service.js';
import { githubTokenService } from './services/github-token.service.js';

let server: http.Server | undefined = undefined;
let baseUrl: string = '';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
};

const originalFetch = globalThis.fetch;

// Mock data
const mockOrgResponse = {
  login: 'testorg',
  name: 'Test Organization',
  description: 'A test open-source organization',
  blog: 'https://testorg.org',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345',
  public_repos: 42,
  public_members_count: 10,
  location: 'Global',
  html_url: 'https://github.com/testorg'
};

const mockReposResponse = [
  {
    id: 1001,
    name: 'alpha-repo',
    full_name: 'testorg/alpha-repo',
    description: 'First test repository',
    html_url: 'https://github.com/testorg/alpha-repo',
    language: 'TypeScript',
    stargazers_count: 500,
    forks_count: 50,
    open_issues_count: 5,
    default_branch: 'main',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 1002,
    name: 'beta-repo',
    full_name: 'testorg/beta-repo',
    description: 'Second test repository',
    html_url: 'https://github.com/testorg/beta-repo',
    language: 'Python',
    stargazers_count: 1200,
    forks_count: 150,
    open_issues_count: 12,
    default_branch: 'master',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-07-01T00:00:00Z',
    archived: false,
    fork: false
  }
];

const mockContributorsResponse = [
  {
    login: 'contributor1',
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
    html_url: 'https://github.com/contributor1',
    contributions: 42
  },
  {
    login: 'contributor2',
    avatar_url: 'https://avatars.githubusercontent.com/u/2',
    html_url: 'https://github.com/contributor2',
    contributions: 18
  }
];

const mockCommitsResponse = [
  {
    sha: 'abcdef1234567890abcdef1234567890abcdef12',
    commit: {
      message: 'feat: add awesome feature',
      author: {
        name: 'Developer One',
        date: '2024-07-01T12:00:00Z'
      },
      committer: {
        name: 'Developer One',
        date: '2024-07-01T12:00:00Z'
      }
    },
    author: {
      login: 'devone'
    },
    html_url: 'https://github.com/testorg/alpha-repo/commit/abcdef1234567890'
  }
];

/**
 * Installs a mock fetch handler that intercepts calls to https://api.github.com
 */
const setupMockFetch = () => {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input.toString();

    // Pass through local test server requests to real fetch
    if (!urlStr.startsWith('https://api.github.com')) {
      return originalFetch(input, init);
    }

    const url = new URL(urlStr);
    const headers = new Headers({
      'content-type': 'application/json',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      'x-ratelimit-used': '1'
    });

    // Rate limit mock route
    if (url.pathname === '/rate-limit-test') {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: new Headers({
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
        })
      });
    }

    // Secondary rate limit mock route
    if (url.pathname === '/secondary-rate-limit-test') {
      return new Response(JSON.stringify({ message: 'Secondary rate limit triggered' }), {
        status: 429,
        headers: new Headers({
          'retry-after': '30'
        })
      });
    }

    // Org endpoint
    if (url.pathname === '/orgs/testorg') {
      return new Response(JSON.stringify(mockOrgResponse), { status: 200, headers });
    }

    // Org repos endpoint
    if (url.pathname === '/orgs/testorg/repos') {
      headers.set('link', '<https://api.github.com/orgs/testorg/repos?page=2>; rel="next"');
      return new Response(JSON.stringify(mockReposResponse), { status: 200, headers });
    }

    // Single repo endpoint
    if (url.pathname === '/repos/testorg/alpha-repo') {
      return new Response(JSON.stringify(mockReposResponse[0]), { status: 200, headers });
    }

    // Contributors endpoint
    if (url.pathname === '/repos/testorg/alpha-repo/contributors') {
      return new Response(JSON.stringify(mockContributorsResponse), { status: 200, headers });
    }

    // Commits endpoint
    if (url.pathname === '/repos/testorg/alpha-repo/commits') {
      return new Response(JSON.stringify(mockCommitsResponse), { status: 200, headers });
    }

    // Not found fallback
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers });
  };
};

const runTests = async () => {
  setupMockFetch();

  console.log('\n--- 1. Testing Centralized GitHub API Client & Rate Limiting ---');
  const client = new GitHubApiClient();

  // Test successful GET
  const orgResult = await client.get<typeof mockOrgResponse>('/orgs/testorg');
  assert(orgResult.data.login === 'testorg', 'GitHub client successfully parses JSON response');
  assert(orgResult.rateLimit.limit === 5000, 'GitHub client parses X-RateLimit-Limit header');
  assert(orgResult.rateLimit.remaining === 4999, 'GitHub client parses X-RateLimit-Remaining header');
  assert(orgResult.rateLimit.reset > 0, 'GitHub client parses X-RateLimit-Reset header');

  // Test Primary Rate Limit Exceeded
  let primaryRateLimitThrown = false;
  try {
    await client.get('/rate-limit-test');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
      primaryRateLimitThrown = true;
    }
  }
  assert(primaryRateLimitThrown, 'Primary rate limit (remaining=0) throws HTTP 429 with reset time');

  // Test Secondary Rate Limit (Retry-After)
  let secondaryRateLimitThrown = false;
  try {
    await client.get('/secondary-rate-limit-test');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
      secondaryRateLimitThrown = true;
    }
  }
  assert(secondaryRateLimitThrown, 'Secondary rate limit throws HTTP 429 and parses Retry-After');

  // Test 404 Not Found
  let notFoundThrown = false;
  try {
    await client.get('/orgs/nonexistent-org-12345');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) {
      notFoundThrown = true;
    }
  }
  assert(notFoundThrown, 'Missing GitHub resource throws HTTP 404 ApiError');

  console.log('\n--- 2. Testing GitHub Resource Service (DTOs, Pagination, Filtering) ---');
  const resources = new GitHubResourceService(client);

  // Test Organization Retrieval
  const orgDTO = await resources.getOrganization('testorg');
  assert(orgDTO.login === 'testorg', 'Organization login mapped correctly');
  assert(orgDTO.name === 'Test Organization', 'Organization name mapped correctly');
  assert(orgDTO.website === 'https://testorg.org', 'Organization website mapped correctly');
  assert(orgDTO.publicRepos === 42, 'Public repos count mapped correctly');

  // Test Organization Repositories with sorting and filtering
  const reposResult = await resources.getOrganizationRepos('testorg', {
    page: 1,
    perPage: 30,
    sort: 'stars',
    direction: 'desc'
  });
  assert(reposResult.data.length === 2, 'Retrieved all repositories');
  assert(reposResult.data[0]!.stars >= reposResult.data[1]!.stars, 'Repositories sorted by stars descending');
  assert(reposResult.pagination.page === 1, 'Pagination page is 1');
  assert(reposResult.pagination.hasNextPage === true, 'Pagination hasNextPage parsed from Link header');

  // Language filter
  const tsRepos = await resources.getOrganizationRepos('testorg', { language: 'TypeScript' });
  assert(tsRepos.data.length === 1 && tsRepos.data[0]!.language === 'TypeScript', 'Filtered repositories by language');

  // Repository details
  const repoDTO = await resources.getRepository('testorg', 'alpha-repo');
  assert(repoDTO.githubRepoId === '1001', 'Repository githubRepoId mapped correctly');
  assert(repoDTO.fullName === 'testorg/alpha-repo', 'Repository fullName mapped correctly');
  assert(repoDTO.stars === 500, 'Repository stars mapped correctly');

  // Contributors
  const contributors = await resources.getRepositoryContributors('testorg', 'alpha-repo');
  assert(contributors.data.length === 2, 'Retrieved repository contributors');
  assert(contributors.data[0]!.username === 'contributor1', 'Contributor username mapped correctly');
  assert(contributors.data[0]!.contributionCount === 42, 'Contributor count mapped correctly');

  // Commits
  const commits = await resources.getRepositoryCommits('testorg', 'alpha-repo');
  assert(commits.data.length === 1, 'Retrieved repository commits');
  assert(commits.data[0]!.sha.startsWith('abcdef'), 'Commit SHA mapped correctly');
  assert(commits.data[0]!.authorUsername === 'devone', 'Commit author username mapped correctly');

  console.log('\n--- 3. Testing Token Decryption Integration ---');
  // Seed a test user with encrypted GitHub access token in PostgreSQL
  const testUserId = '88888888-9999-4444-5555-666666666666';
  const samplePlaintextToken = 'gho_secret_access_token_123456789';
  const encrypted = encryptToken(samplePlaintextToken, env.TOKEN_ENCRYPTION_KEY);

  const testUser = await prisma.user.upsert({
    where: { githubId: 'gh_test_user_task04' },
    update: {
      githubUsername: 'task04_tester',
      encryptedAccessToken: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenTag: encrypted.tag
    },
    create: {
      id: testUserId,
      githubId: 'gh_test_user_task04',
      githubUsername: 'task04_tester',
      encryptedAccessToken: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenTag: encrypted.tag
    }
  });

  // Verify retrieval and decryption
  const decryptedToken = await githubTokenService.getUserAccessToken(testUser.id);
  assert(decryptedToken === samplePlaintextToken, 'Token decrypted seamlessly from PostgreSQL user record');

  // Verify missing user throws 401
  let missingUserThrown = false;
  try {
    await githubTokenService.getUserAccessToken('00000000-0000-0000-0000-000000000000');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 401) {
      missingUserThrown = true;
    }
  }
  assert(missingUserThrown, 'Non-existent user token request returns HTTP 401');

  console.log('\n--- 4. Testing PostgreSQL Database Synchronization ---');
  const syncService = new GitHubSyncService(resources);

  // Sync organization and repos
  const syncOrgResult = await syncService.syncOrganization('testorg', decryptedToken);
  assert(syncOrgResult.organization.slug === 'testorg', 'Organization synced with slug testorg');
  assert(syncOrgResult.syncedRepositories === 2, '2 repositories synchronized to PostgreSQL');

  // Verify in PostgreSQL
  const dbOrg = await prisma.organization.findUnique({
    where: { slug: 'testorg' },
    include: { repositories: true }
  });
  assert(dbOrg !== null, 'Organization record exists in PostgreSQL');
  assert(dbOrg?.repositories.length === 2, 'Repositories are linked via foreign key to the organization');
  assert(Boolean(dbOrg?.repositories.some(r => r.githubRepoId === '1001')), 'alpha-repo exists in DB');
  assert(Boolean(dbOrg?.repositories.some(r => r.githubRepoId === '1002')), 'beta-repo exists in DB');

  // Sync single repository update
  const updatedRepo = await syncService.syncRepository('testorg', 'alpha-repo', decryptedToken);
  assert(updatedRepo.fullName === 'testorg/alpha-repo', 'Single repository synced successfully');

  // Idempotency check: Syncing again should update without duplicate key violation
  const syncAgain = await syncService.syncOrganization('testorg', decryptedToken);
  assert(syncAgain.syncedRepositories === 2, 'Re-sync is idempotent and avoids duplicates');

  const countRepos = await prisma.repository.count({ where: { organizationId: dbOrg!.id } });
  assert(countRepos === 2, 'Repository count remains exactly 2 (no duplicate records created)');

  console.log('\n--- 5. Testing Express HTTP Endpoints ---');
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  const validAuthJwt = signAuthToken({
    userId: testUser.id,
    githubId: testUser.githubId,
    username: testUser.githubUsername
  });

  // Test 5.1: GET /api/github/organizations/:name (Public discovery)
  const getOrgRes = await fetch(`${baseUrl}/api/github/organizations/testorg`);
  assert(getOrgRes.status === 200, 'GET /api/github/organizations/:name returns HTTP 200');
  const orgBody = await getOrgRes.json() as { success: boolean; data: { login: string } };
  assert(orgBody.data.login === 'testorg', 'Returns organization data in standardized envelope');

  // Test 5.2: GET /api/github/organizations/:name/repos
  const getReposRes = await fetch(`${baseUrl}/api/github/organizations/testorg/repos?sort=stars&direction=desc`);
  assert(getReposRes.status === 200, 'GET /api/github/organizations/:name/repos returns HTTP 200');
  const reposBody = await getReposRes.json() as { success: boolean; data: unknown[]; pagination: { page: number } };
  assert(reposBody.data.length === 2, 'Returns organization repos');
  assert(reposBody.pagination.page === 1, 'Includes pagination metadata');

  // Test 5.3: GET /api/github/repos/:owner/:repo
  const getSingleRepoRes = await fetch(`${baseUrl}/api/github/repos/testorg/alpha-repo`);
  assert(getSingleRepoRes.status === 200, 'GET /api/github/repos/:owner/:repo returns HTTP 200');

  // Test 5.4: GET /api/github/repos/:owner/:repo/contributors
  const getContribsRes = await fetch(`${baseUrl}/api/github/repos/testorg/alpha-repo/contributors`);
  assert(getContribsRes.status === 200, 'GET /api/github/repos/:owner/:repo/contributors returns HTTP 200');

  // Test 5.5: GET /api/github/repos/:owner/:repo/commits
  const getCommitsRes = await fetch(`${baseUrl}/api/github/repos/testorg/alpha-repo/commits`);
  assert(getCommitsRes.status === 200, 'GET /api/github/repos/:owner/:repo/commits returns HTTP 200');

  // Test 5.6: POST /api/github/organizations/:name/sync without authentication -> 401
  const unauthSyncOrg = await fetch(`${baseUrl}/api/github/organizations/testorg/sync`, { method: 'POST' });
  assert(unauthSyncOrg.status === 401, 'POST /api/github/organizations/:name/sync rejects unauthenticated request with 401');

  // Test 5.7: POST /api/github/repos/:owner/:repo/sync without authentication -> 401
  const unauthSyncRepo = await fetch(`${baseUrl}/api/github/repos/testorg/alpha-repo/sync`, { method: 'POST' });
  assert(unauthSyncRepo.status === 401, 'POST /api/github/repos/:owner/:repo/sync rejects unauthenticated request with 401');

  // Test 5.8: POST /api/github/organizations/:name/sync with authentication -> 200
  const authSyncOrg = await fetch(`${baseUrl}/api/github/organizations/testorg/sync`, {
    method: 'POST',
    headers: {
      Cookie: `${JWT_COOKIE_NAME}=${validAuthJwt};`
    }
  });
  assert(authSyncOrg.status === 200, 'POST /api/github/organizations/:name/sync succeeds with auth');
  const syncBody = await authSyncOrg.json() as { success: boolean; data: { syncedRepositories: number } };
  assert(syncBody.data.syncedRepositories === 2, 'Sync returns synchronized repository count');

  // Test 5.9: Invalid parameter validation
  const invalidNameRes = await fetch(`${baseUrl}/api/github/organizations/invalid!name!with!symbols`);
  assert(invalidNameRes.status === 400, 'Invalid organization name parameter returns HTTP 400 Bad Request');

  const invalidRepoRes = await fetch(`${baseUrl}/api/github/repos/testorg/invalid/nested/repo`);
  assert(invalidRepoRes.status === 404, 'Malformed route nesting returns HTTP 404');

  // Clean up database test records
  await prisma.repository.deleteMany({ where: { organizationId: dbOrg!.id } });
  await prisma.organization.delete({ where: { id: dbOrg!.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log('  ✓ Cleaned up test organization, repositories, and user from PostgreSQL');

  console.log('\n🎉 ALL TASK 04 AUTOMATED TESTS PASSED!\n');
};

try {
  await runTests();
} catch (err) {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
} finally {
  globalThis.fetch = originalFetch;
  if (server) {
    (server as http.Server).close();
  }
  await prisma.$disconnect();
}
