import http from 'node:http';
import app from './app.js';
import { prisma } from './config/prisma.js';
import { SCORING_CONFIG, isBeginnerLabel } from './services/intelligence/scoring.config.js';
import { intelligenceCalculationService } from './services/intelligence/intelligence.service.js';
import type {
  GitHubRepoDTO,
  GitHubCommitDTO,
  GitHubContributorDTO,
  GitHubIssueDTO,
  CommunityProfileDTO
} from './types/index.js';

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

// Helper to create mock repo
function createMockRepo(overrides: Partial<GitHubRepoDTO> = {}): GitHubRepoDTO {
  return {
    githubRepoId: '999001',
    name: 'intel-test-repo',
    fullName: 'intel-org/intel-test-repo',
    description: 'A comprehensive repository for testing intelligence scoring',
    htmlUrl: 'https://github.com/intel-org/intel-test-repo',
    language: 'TypeScript',
    stars: 1250,
    forks: 340,
    openIssues: 15,
    defaultBranch: 'main',
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isArchived: false,
    isFork: false,
    ...overrides
  };
}

// Helper to create mock commits
function createMockCommits(count: number, daysAgoStart: number = 1): GitHubCommitDTO[] {
  const commits: GitHubCommitDTO[] = [];
  for (let i = 0; i < count; i++) {
    const commitDate = new Date(
      Date.now() - (daysAgoStart + i * 2) * 24 * 60 * 60 * 1000
    ).toISOString();
    commits.push({
      sha: `sha_${i}_${Math.random().toString(36).substring(7)}`,
      message: `feat: commit message #${i}`,
      authorName: `Dev ${i % 5}`,
      authorUsername: `dev_${i % 5}`,
      commitDate,
      commitUrl: `https://github.com/intel-org/intel-test-repo/commit/sha_${i}`
    });
  }
  return commits;
}

// Helper to create mock contributors
function createMockContributors(
  count: number,
  skewTop: boolean = false
): GitHubContributorDTO[] {
  const contributors: GitHubContributorDTO[] = [];
  for (let i = 0; i < count; i++) {
    const contributionCount = skewTop && i === 0 ? 1000 : 10;
    contributors.push({
      username: `contributor_${i}`,
      avatarUrl: `https://avatars.githubusercontent.com/u/${i}`,
      profileUrl: `https://github.com/contributor_${i}`,
      contributionCount
    });
  }
  return contributors;
}

// Helper to create mock issues
function createMockIssues(
  openCount: number,
  closedCount: number,
  beginnerCount: number
): { openIssues: GitHubIssueDTO[]; closedIssues: GitHubIssueDTO[] } {
  const openIssues: GitHubIssueDTO[] = [];
  const closedIssues: GitHubIssueDTO[] = [];

  for (let i = 0; i < openCount; i++) {
    const isBeginner = i < beginnerCount;
    const labels = isBeginner
      ? ['good first issue', 'help wanted', 'bug']
      : ['bug', 'enhancement'];
    openIssues.push({
      githubIssueId: `issue_open_${i}`,
      number: i + 1,
      title: `Open issue #${i + 1}`,
      url: `https://github.com/intel-org/intel-test-repo/issues/${i + 1}`,
      state: 'open',
      labels,
      body: 'Issue description',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      isBeginnerFriendly: isBeginner,
      matchingLabels: isBeginner ? ['good first issue', 'help wanted'] : []
    });
  }

  for (let i = 0; i < closedCount; i++) {
    closedIssues.push({
      githubIssueId: `issue_closed_${i}`,
      number: openCount + i + 1,
      title: `Closed issue #${i + 1}`,
      url: `https://github.com/intel-org/intel-test-repo/issues/${openCount + i + 1}`,
      state: 'closed',
      labels: ['bug'],
      body: 'Resolved issue description',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      isBeginnerFriendly: false,
      matchingLabels: []
    });
  }

  return { openIssues, closedIssues };
}

// Helper to create mock community profile
function createMockCommunity(overrides: Partial<CommunityProfileDTO> = {}): CommunityProfileDTO {
  return {
    healthPercentage: 100,
    hasReadme: true,
    hasContributing: true,
    hasLicense: true,
    hasCodeOfConduct: true,
    hasIssueTemplates: true,
    hasPullRequestTemplates: true,
    ...overrides
  };
}

async function runTests() {
  console.log('🚀 Starting KillSoc Task 05: Repository Intelligence Engine Tests...\n');

  try {
    // =========================================================================
    // SECTION 1: Beginner Label Matching Unit Tests
    // =========================================================================
    console.log('--- 1. Testing Beginner Friendly Label Matching ---');
    assert(isBeginnerLabel('good first issue'), 'Matches exact "good first issue"');
    assert(isBeginnerLabel('good-first-issue'), 'Matches kebab-case "good-first-issue"');
    assert(isBeginnerLabel('GOOD FIRST ISSUE'), 'Matches case-insensitively');
    assert(isBeginnerLabel('help wanted'), 'Matches "help wanted"');
    assert(isBeginnerLabel('beginner'), 'Matches "beginner"');
    assert(isBeginnerLabel('easy'), 'Matches "easy"');
    assert(isBeginnerLabel('first-timers-only'), 'Matches "first-timers-only"');
    assert(isBeginnerLabel('up-for-grabs'), 'Matches "up-for-grabs"');
    assert(!isBeginnerLabel('bug'), 'Does not match "bug"');
    assert(!isBeginnerLabel('enhancement'), 'Does not match "enhancement"');
    assert(!isBeginnerLabel('wontfix'), 'Does not match "wontfix"');
    assert(!isBeginnerLabel('documentation'), 'Does not match "documentation"');

    // =========================================================================
    // SECTION 2: Intelligence Scoring Engine Unit Tests
    // =========================================================================
    console.log('\n--- 2. Testing Intelligence Metric Calculations ---');
    const calc = intelligenceCalculationService;

    // A. Activity Score Tests
    console.log('Testing Activity Score:');
    const activeRepo = createMockRepo();
    const activeCommits = createMockCommits(12, 1); // 12 commits in recent days
    const { openIssues: activeOpenIssues } = createMockIssues(10, 10, 3);
    const highActivity = calc.calculateActivityScore(activeRepo, activeCommits, activeOpenIssues);

    assert(highActivity.score >= 85, `High activity score is >= 85 (got ${highActivity.score})`);
    assert(highActivity.explanations.length >= 2, 'Activity explanations provided');

    const dormantRepo = createMockRepo({
      lastUpdatedAt: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString()
    });
    const dormantCommits: GitHubCommitDTO[] = [];
    const lowActivity = calc.calculateActivityScore(dormantRepo, dormantCommits, []);
    assert(lowActivity.score <= 15, `Dormant activity score is <= 15 (got ${lowActivity.score})`);

    // B. Community Score Tests
    console.log('Testing Community Score:');
    const diverseContributors = createMockContributors(35, false);
    const { openIssues: commOpen, closedIssues: commClosed } = createMockIssues(10, 20, 2); // 20/30 = 66% resolution
    const highCommunity = calc.calculateCommunityScore(diverseContributors, commOpen, commClosed);
    assert(highCommunity.score >= 85, `Diverse community score is >= 85 (got ${highCommunity.score})`);

    const soloContributor = createMockContributors(1, true);
    const { openIssues: soloOpen, closedIssues: soloClosed } = createMockIssues(10, 0, 0); // 0% closed
    const lowCommunity = calc.calculateCommunityScore(soloContributor, soloOpen, soloClosed);
    assert(lowCommunity.score <= 25, `Solo contributor community score is <= 25 (got ${lowCommunity.score})`);

    // C. Documentation Score Tests
    console.log('Testing Documentation Score:');
    const fullDocs = createMockCommunity();
    const fullDocScore = calc.calculateDocumentationScore(activeRepo, fullDocs);
    assert(fullDocScore.score === 100, `Full documentation score is 100 (got ${fullDocScore.score})`);

    const partialDocs = createMockCommunity({
      hasContributing: false,
      hasLicense: false,
      hasCodeOfConduct: false,
      hasIssueTemplates: false,
      hasPullRequestTemplates: false
    });
    const partialDocScore = calc.calculateDocumentationScore(activeRepo, partialDocs);
    assert(partialDocScore.score === 45, `Partial docs (readme + description) is 45 (got ${partialDocScore.score})`);

    const zeroDocs = createMockCommunity({
      hasReadme: false,
      hasContributing: false,
      hasLicense: false,
      hasCodeOfConduct: false,
      hasIssueTemplates: false,
      hasPullRequestTemplates: false
    });
    const zeroRepo = createMockRepo({ description: null });
    const zeroDocScore = calc.calculateDocumentationScore(zeroRepo, zeroDocs);
    assert(zeroDocScore.score === 0, `Zero docs score is 0 (got ${zeroDocScore.score})`);

    // D. Beginner Friendliness Score Tests
    console.log('Testing Beginner Friendliness Score:');
    const { openIssues: beginnerOpenIssues } = createMockIssues(15, 5, 6); // 6 beginner issues
    const highBeginner = calc.calculateBeginnerScore(beginnerOpenIssues, fullDocs);
    assert(highBeginner.score >= 85, `High beginner friendliness is >= 85 (got ${highBeginner.score})`);

    const { openIssues: noBeginnerOpenIssues } = createMockIssues(10, 5, 0); // 0 beginner issues
    const lowBeginner = calc.calculateBeginnerScore(noBeginnerOpenIssues, zeroDocs);
    assert(lowBeginner.score === 0, `No beginner issues and no guide score is 0 (got ${lowBeginner.score})`);

    // E. Maintenance Score & Archived Status Tests
    console.log('Testing Maintenance Score & Archived Status:');
    const highMaintenance = calc.calculateMaintenanceScore(activeRepo, activeCommits, activeOpenIssues);
    assert(highMaintenance.score >= 85, `Active repository maintenance is >= 85 (got ${highMaintenance.score})`);

    const archivedRepo = createMockRepo({ isArchived: true });
    const archivedMaintenance = calc.calculateMaintenanceScore(archivedRepo, activeCommits, activeOpenIssues);
    assert(archivedMaintenance.score === 0, `Archived repository maintenance score is STRICTLY 0 (got ${archivedMaintenance.score})`);
    assert(
      archivedMaintenance.explanations.some(e => e.includes('archived')),
      'Explanation notes repository is archived'
    );

    // =========================================================================
    // SECTION 3: Overall Score and Weighting Verification
    // =========================================================================
    console.log('\n--- 3. Testing Overall Score & Normalization ---');
    const completeReport = calc.calculateReport({
      repo: activeRepo,
      commits: activeCommits,
      contributors: diverseContributors,
      openIssues: activeOpenIssues,
      closedIssues: commClosed,
      community: fullDocs,
      isDataComplete: true
    });

    assert(completeReport.scores.overall >= 80, `Complete active repo overall score >= 80 (got ${completeReport.scores.overall})`);
    assert(completeReport.isComplete === true, 'Report isComplete is true');
    assert(completeReport.metricsSummary.beginnerIssuesCount === 3, 'Beginner issues count recorded correctly');
    assert(completeReport.metricsSummary.documentation.hasContributing === true, 'Contributing doc flag recorded');

    // Test Archived Cap
    const archivedReport = calc.calculateReport({
      repo: archivedRepo,
      commits: activeCommits,
      contributors: diverseContributors,
      openIssues: activeOpenIssues,
      closedIssues: commClosed,
      community: fullDocs,
      isDataComplete: true
    });

    assert(archivedReport.scores.maintenance === 0, 'Archived report maintenance is 0');
    assert(
      archivedReport.scores.overall <= SCORING_CONFIG.archivedScoreCap,
      `Archived repository overall score is capped at ${SCORING_CONFIG.archivedScoreCap} (got ${archivedReport.scores.overall})`
    );
    assert(
      archivedReport.explanations.overall.some(e => e.includes('archived')),
      'Archived overall explanation explicitly states capping rule'
    );

    // Test Incomplete Data Flag
    const incompleteReport = calc.calculateReport({
      repo: activeRepo,
      commits: [],
      contributors: [],
      openIssues: [],
      closedIssues: [],
      community: zeroDocs,
      isDataComplete: false
    });
    assert(incompleteReport.isComplete === false, 'Incomplete data sets isComplete = false');

    // =========================================================================
    // SECTION 4: Database Persistence & Cache Verification
    // =========================================================================
    console.log('\n--- 4. Testing PostgreSQL Persistence & Prisma Integration ---');
    const testRepoFullName = `intel-org/test-persist-${Date.now()}`;
    const testDbRepo = await prisma.repository.create({
      data: {
        githubRepoId: `test_id_${Date.now()}`,
        name: 'test-persist',
        fullName: testRepoFullName,
        description: 'Persistence test repository',
        language: 'TypeScript',
        stars: 300,
        forks: 40,
        openIssues: 5
      }
    });

    // Create analysis record
    const createdAnalysis = await prisma.repositoryAnalysis.create({
      data: {
        repositoryId: testDbRepo.id,
        overallScore: 82.5,
        activityScore: 85.0,
        communityScore: 78.0,
        documentationScore: 90.0,
        beginnerScore: 75.0,
        maintenanceScore: 88.0,
        explanations: completeReport.explanations as any,
        metricsSummary: completeReport.metricsSummary as any,
        isComplete: true
      }
    });

    assert(Boolean(createdAnalysis.id), 'Successfully inserted RepositoryAnalysis in PostgreSQL');
    assert(createdAnalysis.overallScore === 82.5, 'overallScore stored accurately');

    // Update / Upsert analysis record
    const updatedAnalysis = await prisma.repositoryAnalysis.upsert({
      where: { repositoryId: testDbRepo.id },
      update: {
        overallScore: 91.0,
        lastAnalyzedAt: new Date()
      },
      create: {
        repositoryId: testDbRepo.id,
        overallScore: 91.0,
        activityScore: 85.0,
        communityScore: 78.0,
        documentationScore: 90.0,
        beginnerScore: 75.0,
        maintenanceScore: 88.0,
        explanations: completeReport.explanations as any,
        metricsSummary: completeReport.metricsSummary as any,
        isComplete: true
      }
    });

    assert(updatedAnalysis.overallScore === 91.0, 'RepositoryAnalysis successfully updated via upsert');

    // Verify cascade deletion
    await prisma.repository.delete({
      where: { id: testDbRepo.id }
    });

    const orphanedAnalysis = await prisma.repositoryAnalysis.findUnique({
      where: { repositoryId: testDbRepo.id }
    });
    assert(orphanedAnalysis === null, 'Cascading deletion verified: RepositoryAnalysis deleted with Repository');

    // =========================================================================
    // SECTION 5: End-to-End REST API Endpoint Tests
    // =========================================================================
    console.log('\n--- 5. Testing REST API Endpoints ---');

    // Start server on free test port
    const testPort = 5098;
    server = app.listen(testPort);
    baseUrl = `http://localhost:${testPort}/api`;

    // Mock fetch for GitHub API endpoints
    const mockRepoData = {
      id: 888123,
      name: 'express',
      full_name: 'expressjs/express',
      description: 'Fast, unopinionated, minimalist web framework for node.',
      html_url: 'https://github.com/expressjs/express',
      language: 'JavaScript',
      stargazers_count: 65000,
      forks_count: 12000,
      open_issues_count: 25,
      default_branch: 'master',
      created_at: '2010-12-29T19:38:25Z',
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      archived: false,
      fork: false
    };

    const mockCommitsData = createMockCommits(15, 1).map(c => ({
      sha: c.sha,
      commit: {
        message: c.message,
        author: { name: c.authorName, date: c.commitDate },
        committer: { name: c.authorName, date: c.commitDate }
      },
      author: { login: c.authorUsername },
      html_url: c.commitUrl
    }));

    const mockContributorsData = [
      { login: 'contributor1', avatar_url: 'https://avatar.url', html_url: 'https://github.com/c1', contributions: 50 },
      { login: 'contributor2', avatar_url: 'https://avatar.url', html_url: 'https://github.com/c2', contributions: 30 }
    ];

    const mockIssuesData = [
      {
        id: 101,
        number: 101,
        title: 'Improve documentation formatting',
        body: 'Details here',
        html_url: 'https://github.com/expressjs/express/issues/101',
        state: 'open',
        labels: [{ name: 'good first issue' }, { name: 'help wanted' }],
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        closed_at: null
      },
      {
        id: 102,
        number: 102,
        title: 'Memory leak under high load',
        body: 'Details here',
        html_url: 'https://github.com/expressjs/express/issues/102',
        state: 'open',
        labels: [{ name: 'bug' }],
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        closed_at: null
      }
    ];

    const mockCommunityData = {
      health_percentage: 100,
      files: {
        readme: { url: 'https://api.github.com/readme' },
        contributing: { url: 'https://api.github.com/contributing' },
        license: { key: 'mit' },
        code_of_conduct: { key: 'contributor-covenant' },
        issue_template: { url: 'https://api.github.com/issue_template' }
      }
    };

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = String(input);

      // Local API requests
      if (urlStr.includes(`localhost:${testPort}`)) {
        return originalFetch(input, init);
      }

      // GitHub API Mocks
      if (urlStr.includes('/community/profile')) {
        return new Response(JSON.stringify(mockCommunityData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' }
        });
      }

      if (urlStr.includes('/commits')) {
        return new Response(JSON.stringify(mockCommitsData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' }
        });
      }

      if (urlStr.includes('/contributors')) {
        return new Response(JSON.stringify(mockContributorsData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' }
        });
      }

      if (urlStr.includes('/issues')) {
        return new Response(JSON.stringify(mockIssuesData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' }
        });
      }

      if (urlStr.includes('/repos/expressjs/express')) {
        return new Response(JSON.stringify(mockRepoData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-ratelimit-remaining': '4999' }
        });
      }

      if (urlStr.includes('/orgs/expressjs')) {
        return new Response(
          JSON.stringify({
            login: 'expressjs',
            name: 'Express.js',
            description: 'Fast, unopinionated, minimalist web framework for node.',
            avatar_url: 'https://avatars.githubusercontent.com/u/expressjs',
            public_repos: 30,
            html_url: 'https://github.com/expressjs'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    // Test GET /api/intelligence/repos/:owner/:repo
    console.log('Testing GET /api/intelligence/repos/:owner/:repo:');
    const getRes = await originalFetch(`${baseUrl}/intelligence/repos/expressjs/express`);
    const getBody = (await getRes.json()) as any;

    assert(getRes.status === 200, `Status is 200 OK (got ${getRes.status})`);
    assert(getBody.success === true, 'Response success is true');
    assert(Boolean(getBody.data.scores), 'Intelligence scores returned');
    assert(getBody.data.scores.overall >= 0 && getBody.data.scores.overall <= 100, 'Overall score in 0-100 range');
    assert(getBody.data.scores.activity >= 0 && getBody.data.scores.activity <= 100, 'Activity score in 0-100 range');
    assert(getBody.data.scores.maintenance >= 0 && getBody.data.scores.maintenance <= 100, 'Maintenance score in 0-100 range');
    assert(getBody.data.scores.community >= 0 && getBody.data.scores.community <= 100, 'Community score in 0-100 range');
    assert(getBody.data.scores.documentation >= 0 && getBody.data.scores.documentation <= 100, 'Documentation score in 0-100 range');
    assert(getBody.data.scores.beginner >= 0 && getBody.data.scores.beginner <= 100, 'Beginner friendliness score in 0-100 range');
    assert(Array.isArray(getBody.data.explanations.overall), 'Overall explanations array present');
    assert(Boolean(getBody.data.metricsSummary), 'Metrics summary object present');

    // Test POST /api/intelligence/repos/:owner/:repo/analyze
    console.log('Testing POST /api/intelligence/repos/:owner/:repo/analyze:');
    const postRes = await originalFetch(`${baseUrl}/intelligence/repos/expressjs/express/analyze`, {
      method: 'POST'
    });
    const postBody = (await postRes.json()) as any;

    assert(postRes.status === 200, `Status is 200 OK (got ${postRes.status})`);
    assert(postBody.success === true, 'Response success is true');
    assert(Boolean(postBody.data.id), 'Persisted analysis ID returned');

    // Test GET /api/intelligence/repos/:owner/:repo/issues
    console.log('Testing GET /api/intelligence/repos/:owner/:repo/issues:');
    const issuesRes = await originalFetch(`${baseUrl}/intelligence/repos/expressjs/express/issues`);
    const issuesBody = (await issuesRes.json()) as any;

    assert(issuesRes.status === 200, `Status is 200 OK (got ${issuesRes.status})`);
    assert(issuesBody.success === true, 'Response success is true');
    assert(issuesBody.data.beginnerFriendlyCount === 1, `Found 1 beginner issue (got ${issuesBody.data.beginnerFriendlyCount})`);
    assert(issuesBody.data.beginnerIssues[0].isBeginnerFriendly === true, 'Issue flagged as beginner friendly');
    assert(issuesBody.data.beginnerIssues[0].matchingLabels.includes('good first issue'), 'Matching label is "good first issue"');
    assert(issuesBody.data.otherOpenIssues.length === 1, 'Other open issues segregated');

    // Test 404 handling
    console.log('Testing 404 handling for nonexistent repo:');
    const notFoundRes = await originalFetch(`${baseUrl}/intelligence/repos/unknown-org/nonexistent-repo`);
    assert(notFoundRes.status === 404, `Status is 404 Not Found (got ${notFoundRes.status})`);

    // Clean up test database records
    await prisma.repository.deleteMany({
      where: { fullName: { in: ['expressjs/express', testRepoFullName] } }
    });

    console.log('\n🎉 ALL TASK 05 TESTS PASSED SUCCESSFULLY! ✅\n');
  } finally {
    globalThis.fetch = originalFetch;
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
