import http from 'node:http';
import app from './app.js';
import { prisma } from './config/prisma.js';
import { signAuthToken, JWT_COOKIE_NAME } from './utils/jwt.js';
import { gsocIngestionService } from './services/discovery/gsoc-ingestion.service.js';
import { organizationDiscoveryService } from './services/discovery/organization-discovery.service.js';
import { contributionDiscoveryService, GSOC_SUITABILITY_DISCLAIMER } from './services/discovery/contribution-discovery.service.js';

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

async function runTests() {
  console.log('🚀 Starting KillSoc Task 07: GSoC Organization & Contribution Discovery Tests...\n');

  let adminUserId = '';
  let adminToken = '';
  let devUserId = '';
  let devToken = '';
  const testOrgSlugs: string[] = [];
  const testRepoIds: string[] = [];

  try {
    // =========================================================================
    // SECTION 1: GSoC Organization Ingestion & Validation Unit Tests
    // =========================================================================
    console.log('--- 1. Testing GSoC Ingestion Service & Data Validation ---');

    // Test Slugify
    assert(gsocIngestionService.slugify('Apache Software Foundation') === 'apache-software-foundation', 'Slugifies organization names');
    assert(gsocIngestionService.slugify('C++ / Boost Libraries!') === 'c-boost-libraries', 'Cleans punctuation in slugs');

    // Test GitHub login extraction
    assert(gsocIngestionService.extractGitHubLogin('https://github.com/tensorflow') === 'tensorflow', 'Extracts login from full GitHub URL');
    assert(gsocIngestionService.extractGitHubLogin('expressjs') === 'expressjs', 'Extracts login from bare username');
    assert(gsocIngestionService.extractGitHubLogin('https://gitlab.com/other') === null, 'Rejects non-github domain');

    // Test Entry Validation
    const validEntry = {
      name: 'Python Software Foundation',
      year: 2024,
      website: 'https://python.org',
      githubUrl: 'https://github.com/python'
    };
    assert(gsocIngestionService.validateEntry(validEntry).isValid, 'Validates clean GSoC entry');

    const invalidYear = { name: 'Test Org', year: 1999 };
    assert(!gsocIngestionService.validateEntry(invalidYear).isValid, 'Rejects year prior to 2005');

    const missingName = { name: '', year: 2024 };
    assert(!gsocIngestionService.validateEntry(missingName).isValid, 'Rejects empty organization name');

    const invalidWebsite = { name: 'Test Org', year: 2024, website: 'not-a-url' };
    assert(!gsocIngestionService.validateEntry(invalidWebsite).isValid, 'Rejects malformed website URL');

    // Test Ingesting multiple years & duplicate prevention
    const testOrgName = `Test Org ${Date.now()}`;
    const testOrgSlug = gsocIngestionService.slugify(testOrgName);
    testOrgSlugs.push(testOrgSlug);

    const importResult1 = await gsocIngestionService.ingestOrganizations([
      {
        name: testOrgName,
        year: 2023,
        description: 'First year participating',
        website: 'https://testorg.dev',
        githubUrl: 'https://github.com/test-org',
        category: 'Development Tools',
        topics: ['python', 'typescript']
      }
    ]);

    assert(importResult1.organizationsCreated === 1, 'Created 1 organization');
    assert(importResult1.yearsAdded === 1, 'Added year 2023');

    // Add year 2024 for the same organization
    const importResult2 = await gsocIngestionService.ingestOrganizations([
      {
        name: testOrgName,
        year: 2024,
        description: 'Updated description for 2024',
        website: 'https://testorg.dev',
        githubUrl: 'https://github.com/test-org',
        category: 'Development Tools',
        topics: ['python', 'rust']
      }
    ]);

    assert(importResult2.organizationsCreated === 0, 'Did not duplicate organization record');
    assert(importResult2.organizationsUpdated === 1, 'Updated organization record');
    assert(importResult2.yearsAdded === 1, 'Added year 2024 for existing organization');

    // Re-importing same year is idempotent
    const importResult3 = await gsocIngestionService.ingestOrganizations([
      {
        name: testOrgName,
        year: 2024,
        description: 'Idempotent check',
        website: 'https://testorg.dev'
      }
    ]);
    assert(importResult3.yearsAdded === 0, 'Does not duplicate organization-year record');

    // =========================================================================
    // SECTION 2: Organization Discovery Service Unit Tests
    // =========================================================================
    console.log('\n--- 2. Testing Organization Discovery & Filtering ---');

    // Create a candidate repository linked to the test organization
    const dbOrg = await prisma.organization.findUnique({
      where: { slug: testOrgSlug }
    });
    assert(Boolean(dbOrg), 'Test organization retrieved from PostgreSQL');

    const testRepo = await prisma.repository.create({
      data: {
        organizationId: dbOrg!.id,
        githubRepoId: `repo_disc_${Date.now()}`,
        name: 'test-discovery-repo',
        fullName: `test-org/test-discovery-repo-${Date.now()}`,
        description: 'Repository for testing discovery filters',
        language: 'Python',
        stars: 350,
        forks: 50,
        openIssues: 8,
        topics: ['python', 'machine-learning'],
        extractedSkills: ['Python', 'Machine Learning']
      }
    });
    testRepoIds.push(testRepo.id);

    // Attach analysis to repository
    await prisma.repositoryAnalysis.create({
      data: {
        repositoryId: testRepo.id,
        overallScore: 88.5,
        activityScore: 90.0,
        communityScore: 85.0,
        documentationScore: 90.0,
        beginnerScore: 80.0,
        maintenanceScore: 90.0,
        explanations: {} as any,
        metricsSummary: {} as any,
        isComplete: true
      }
    });

    // Test Search filter
    const searchRes = await organizationDiscoveryService.getOrganizations({ search: testOrgName });
    assert(searchRes.data.length >= 1, 'Found organization by name search');
    assert(searchRes.data[0]!.slug === testOrgSlug, 'Search matched correct organization');
    assert(searchRes.data[0]!.years.includes(2024), 'Years include 2024');
    assert(searchRes.data[0]!.years.includes(2023), 'Years include 2023');
    assert(searchRes.data[0]!.repositoryCount >= 1, 'Calculated repository count');
    assert(searchRes.data[0]!.averageQualityScore === 88.5, 'Calculated average quality score from intelligence report');

    // Test Year filter
    const year2024Res = await organizationDiscoveryService.getOrganizations({ year: 2024, search: testOrgName });
    assert(year2024Res.data.length === 1, 'Year filter 2024 matched');

    const year2020Res = await organizationDiscoveryService.getOrganizations({ year: 2020, search: testOrgName });
    assert(year2020Res.data.length === 0, 'Year filter 2020 returned 0 for this org');

    // Test Technology filter
    const techRes = await organizationDiscoveryService.getOrganizations({ technology: 'python', search: testOrgName });
    assert(techRes.data.length === 1, 'Technology filter matched on Python');

    // Test Organization by Slug detail
    const orgDetail = await organizationDiscoveryService.getOrganizationBySlug(testOrgSlug);
    assert(orgDetail.name === testOrgName, 'Retrieved organization detail by slug');
    assert(orgDetail.repositoriesSummary.length >= 1, 'Repositories summary included');
    assert(orgDetail.repositoriesSummary[0]!.qualityScore === 88.5, 'Repository quality score attached');

    // =========================================================================
    // SECTION 3: Contribution Opportunity Discovery Unit Tests
    // =========================================================================
    console.log('\n--- 3. Testing Contribution Opportunity (Issue) Discovery ---');

    // Create test issues: one beginner-friendly, one regular
    await prisma.issue.create({
      data: {
        repositoryId: testRepo.id,
        githubIssueId: `issue_b_${Date.now()}`,
        number: 42,
        title: 'Add docstrings to utility functions',
        description: 'Great task for newcomers to learn Python guidelines',
        url: 'https://github.com/test-org/test-discovery-repo/issues/42',
        state: 'open',
        labels: ['good first issue', 'documentation'],
        isBeginnerFriendly: true,
        matchingLabels: ['good first issue']
      }
    });

    await prisma.issue.create({
      data: {
        repositoryId: testRepo.id,
        githubIssueId: `issue_r_${Date.now()}`,
        number: 43,
        title: 'Implement distributed consensus mechanism',
        description: 'Complex architectural task',
        url: 'https://github.com/test-org/test-discovery-repo/issues/43',
        state: 'open',
        labels: ['enhancement', 'architecture'],
        isBeginnerFriendly: false,
        matchingLabels: []
      }
    });

    // Query all issues for repo
    const allIssues = await contributionDiscoveryService.getIssues({
      repository: 'test-discovery-repo'
    });
    assert(allIssues.data.length >= 2, `Retrieved all open issues (got ${allIssues.data.length})`);
    assert(
      allIssues.data[0]?.gsocSuitabilityDisclaimer === GSOC_SUITABILITY_DISCLAIMER,
      'GSoC suitability disclaimer attached to all discovered issues'
    );

    // Query beginnerOnly issues
    const beginnerOnlyIssues = await contributionDiscoveryService.getIssues({
      repository: 'test-discovery-repo',
      beginnerOnly: true
    });
    assert(beginnerOnlyIssues.data.length === 1, 'beginnerOnly filter returned exactly 1 beginner issue');
    assert(beginnerOnlyIssues.data[0]!.number === 42, 'Matched issue #42');
    assert(beginnerOnlyIssues.data[0]!.isBeginnerFriendly === true, 'isBeginnerFriendly flag is true');

    // Query single issue detail
    const parts = testRepo.fullName.split('/');
    const ownerName = parts[0] || 'test-org';
    const repoName = parts[1] || 'test-discovery-repo';
    const singleIssue = await contributionDiscoveryService.getIssueDetail(ownerName, repoName, 42);
    assert(singleIssue.number === 42, 'Retrieved issue #42 detail');
    assert(singleIssue.matchingLabels.includes('good first issue'), 'Matching beginner label present');
    assert(singleIssue.repository.organizationName === testOrgName, 'Linked organization name attached');

    // =========================================================================
    // SECTION 4: HTTP API Endpoints & Role-Based Permissions
    // =========================================================================
    console.log('\n--- 4. Testing HTTP REST Endpoints & Admin Protection ---');

    // Create Admin User and Developer User in PostgreSQL
    const adminUser = await prisma.user.create({
      data: {
        githubId: `github_admin_${Date.now()}`,
        githubUsername: `admin_${Date.now()}`,
        email: 'admin@killsoc.dev',
        role: 'ADMIN',
        isAdmin: true
      }
    });
    adminUserId = adminUser.id;
    adminToken = signAuthToken({
      userId: adminUser.id,
      githubId: adminUser.githubId,
      username: adminUser.githubUsername
    });

    const devUser = await prisma.user.create({
      data: {
        githubId: `github_dev_${Date.now()}`,
        githubUsername: `dev_${Date.now()}`,
        email: 'dev@killsoc.dev',
        role: 'DEVELOPER',
        isAdmin: false
      }
    });
    devUserId = devUser.id;
    devToken = signAuthToken({
      userId: devUser.id,
      githubId: devUser.githubId,
      username: devUser.githubUsername
    });

    // Add developer skill for devUser to test personal match attachment
    await prisma.developerSkill.create({
      data: {
        userId: devUserId,
        skillName: 'Python',
        proficiency: 'Advanced'
      }
    });

    // Start Express test server
    const testPort = 5100;
    server = app.listen(testPort);
    baseUrl = `http://localhost:${testPort}/api`;

    // 1. GET /api/discovery/organizations (Public)
    const getOrgsRes = await fetch(`${baseUrl}/discovery/organizations?search=${encodeURIComponent(testOrgName)}`);
    assert(getOrgsRes.status === 200, 'GET /api/discovery/organizations is accessible without auth (200)');
    const getOrgsBody = (await getOrgsRes.json()) as any;
    assert(getOrgsBody.data.length >= 1, 'Returns organization list');

    // 2. GET /api/discovery/organizations/:slug (Public)
    const getOrgRes = await fetch(`${baseUrl}/discovery/organizations/${testOrgSlug}`);
    assert(getOrgRes.status === 200, 'GET /api/discovery/organizations/:slug is accessible without auth (200)');

    // 3. GET /api/discovery/organizations/:slug/repos with optional auth (attaches userMatch!)
    const getReposAuthRes = await fetch(`${baseUrl}/discovery/organizations/${testOrgSlug}/repos`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${devToken}` }
    });
    assert(getReposAuthRes.status === 200, 'GET /api/discovery/organizations/:slug/repos returns 200');
    const getReposAuthBody = (await getReposAuthRes.json()) as any;
    assert(getReposAuthBody.data.repositories.length >= 1, 'Returns repositories for organization');
    assert(Boolean(getReposAuthBody.data.repositories[0].userMatch), 'Personalized userMatch attached for authenticated developer');
    assert(getReposAuthBody.data.repositories[0].userMatch.matchedSkills.includes('Python'), 'Matched developer skill Python');

    // 4. GET /api/discovery/issues (Public)
    const getIssuesRes = await fetch(`${baseUrl}/discovery/issues?repository=test-discovery-repo`);
    assert(getIssuesRes.status === 200, 'GET /api/discovery/issues returns 200 without auth');
    const getIssuesBody = (await getIssuesRes.json()) as any;
    assert(getIssuesBody.data.length >= 2, 'Retrieved discovered issues list');

    // 5. GET /api/discovery/issues/:owner/:repo/:issueNumber (Public)
    const getIssueRes = await fetch(`${baseUrl}/discovery/issues/${parts[0]}/${parts[1]}/42`);
    assert(getIssueRes.status === 200, 'GET /api/discovery/issues/:owner/:repo/:issueNumber returns 200');
    const getIssueBody = (await getIssueRes.json()) as any;
    assert(getIssueBody.data.number === 42, 'Returns issue #42');
    assert(getIssueBody.data.isBeginnerFriendly === true, 'Flagged as beginner friendly');

    // 6. POST /api/discovery/organizations/import - Unauthenticated -> 401
    const unauthImportRes = await fetch(`${baseUrl}/discovery/organizations/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizations: [] })
    });
    assert(unauthImportRes.status === 401, 'POST /api/discovery/organizations/import rejected without auth (401)');

    // 7. POST /api/discovery/organizations/import - Non-Admin Developer -> 403 Forbidden
    const devImportRes = await fetch(`${baseUrl}/discovery/organizations/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${devToken}`
      },
      body: JSON.stringify({
        organizations: [{ name: 'Unauthorized Org', year: 2024 }]
      })
    });
    assert(devImportRes.status === 403, 'POST /api/discovery/organizations/import rejected for non-admin developer (403 Forbidden)');

    // 8. POST /api/discovery/organizations/import - Admin -> 200 OK
    const newGSoCOrgName = `Admin Ingested Org ${Date.now()}`;
    const adminImportRes = await fetch(`${baseUrl}/discovery/organizations/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${adminToken}`
      },
      body: JSON.stringify({
        organizations: [
          {
            name: newGSoCOrgName,
            year: 2024,
            description: 'Officially imported by administrator',
            website: 'https://admin-org.dev',
            category: 'Operating Systems',
            topics: ['c++', 'kernel']
          }
        ]
      })
    });
    assert(adminImportRes.status === 200, 'POST /api/discovery/organizations/import succeeded for administrator (200 OK)');
    const adminImportBody = (await adminImportRes.json()) as any;
    assert(adminImportBody.data.organizationsCreated === 1, 'Imported 1 organization as admin');
    testOrgSlugs.push(gsocIngestionService.slugify(newGSoCOrgName));

    // 9. Remote URL Import Mock Test
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = String(input);
      if (urlStr.includes(`localhost:${testPort}`)) {
        return originalFetch(input, init);
      }
      if (urlStr.includes('verified-gsoc-source.json')) {
        return new Response(
          JSON.stringify([
            {
              name: `Remote Ingested Org ${Date.now()}`,
              year: 2024,
              website: 'https://remote-org.dev',
              category: 'Science'
            }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    };

    const remoteImportRes = await originalFetch(`${baseUrl}/discovery/organizations/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${adminToken}`
      },
      body: JSON.stringify({ url: 'https://example.com/verified-gsoc-source.json' })
    });
    assert(remoteImportRes.status === 200, 'Remote URL import succeeded for admin (200 OK)');
    const remoteImportBody = (await remoteImportRes.json()) as any;
    assert(remoteImportBody.data.organizationsCreated === 1, 'Created 1 organization from remote source');

    // 10. POST /api/discovery/organizations/:slug/sync - Sync Organization Repos
    const syncRes = await originalFetch(`${baseUrl}/discovery/organizations/${testOrgSlug}/sync`, {
      method: 'POST',
      headers: { Cookie: `${JWT_COOKIE_NAME}=${devToken}` }
    });
    // If GitHub org is a test org without real GitHub account, returns 404 or succeeds with synced count
    assert(syncRes.status === 200 || syncRes.status === 404, `POST /api/discovery/organizations/:slug/sync handles request cleanly (got ${syncRes.status})`);

    console.log('\n🎉 ALL TASK 07 DISCOVERY TESTS PASSED SUCCESSFULLY! ✅\n');
  } finally {
    globalThis.fetch = originalFetch;

    // Database Cleanup
    if (adminUserId || devUserId) {
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, devUserId].filter(Boolean) } }
      });
    }

    if (testRepoIds.length > 0) {
      await prisma.repository.deleteMany({
        where: { id: { in: testRepoIds } }
      });
    }

    if (testOrgSlugs.length > 0) {
      await prisma.organization.deleteMany({
        where: { slug: { in: testOrgSlugs } }
      });
    }

    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test suite execution failed:', err);
    process.exit(1);
  });
