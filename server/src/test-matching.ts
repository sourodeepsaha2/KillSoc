import http from 'node:http';
import app from './app.js';
import { prisma } from './config/prisma.js';
import { signAuthToken, JWT_COOKIE_NAME } from './utils/jwt.js';
import {
  normalizeSkillName,
  isValidProficiency,
  normalizeProficiency
} from './services/matching/skill-taxonomy.js';
import { developerSkillService } from './services/matching/developer-skill.service.js';
import { repositorySkillExtractor } from './services/matching/repository-skill-extractor.service.js';
import { matchingEngineService } from './services/matching/matching-engine.service.js';
import { recommendationService } from './services/matching/recommendation.service.js';

let server: http.Server | undefined = undefined;
let baseUrl: string = '';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
};

async function runTests() {
  console.log('🚀 Starting KillSoc Task 06: Developer Skill Profile & Matching Engine Tests...\n');

  let userAId = '';
  let userBId = '';
  let userAToken = '';
  let userBToken = '';
  let testRepoId = '';

  try {
    // =========================================================================
    // SECTION 1: Skill Taxonomy & Normalization Unit Tests
    // =========================================================================
    console.log('--- 1. Testing Skill Taxonomy & Normalization ---');
    assert(normalizeSkillName('typescript') === 'TypeScript', 'typescript -> TypeScript');
    assert(normalizeSkillName('  TypeScript  ') === 'TypeScript', 'Trims whitespace');
    assert(normalizeSkillName('reactjs') === 'React', 'reactjs -> React');
    assert(normalizeSkillName('react.js') === 'React', 'react.js -> React');
    assert(normalizeSkillName('node') === 'Node.js', 'node -> Node.js');
    assert(normalizeSkillName('nodejs') === 'Node.js', 'nodejs -> Node.js');
    assert(normalizeSkillName('nextjs') === 'Next.js', 'nextjs -> Next.js');
    assert(normalizeSkillName('postgres') === 'PostgreSQL', 'postgres -> PostgreSQL');
    assert(normalizeSkillName('postgresql') === 'PostgreSQL', 'postgresql -> PostgreSQL');
    assert(normalizeSkillName('k8s') === 'Kubernetes', 'k8s -> Kubernetes');
    assert(normalizeSkillName('dsa') === 'Data Structures and Algorithms', 'dsa -> Data Structures and Algorithms');
    assert(normalizeSkillName('ml') === 'Machine Learning', 'ml -> Machine Learning');
    assert(normalizeSkillName('nlp') === 'NLP', 'nlp -> NLP');
    assert(normalizeSkillName('c++') === 'C++', 'c++ -> C++');
    assert(normalizeSkillName('cpp') === 'C++', 'cpp -> C++');
    assert(normalizeSkillName('golang') === 'Go', 'golang -> Go');

    assert(isValidProficiency('Beginner'), 'Validates "Beginner"');
    assert(isValidProficiency('intermediate'), 'Validates "intermediate" case-insensitively');
    assert(isValidProficiency('Advanced'), 'Validates "Advanced"');
    assert(!isValidProficiency('Expert'), 'Rejects non-standard "Expert"');
    assert(!isValidProficiency(''), 'Rejects empty proficiency');

    assert(normalizeProficiency('beginner') === 'Beginner', 'Normalizes beginner');
    assert(normalizeProficiency('advanced') === 'Advanced', 'Normalizes advanced');
    assert(normalizeProficiency(undefined) === 'Intermediate', 'Defaults to Intermediate');

    // =========================================================================
    // SECTION 2: Repository Skill Extraction Unit Tests
    // =========================================================================
    console.log('\n--- 2. Testing Repository Skill Extraction ---');
    const mockRepo = {
      language: 'TypeScript',
      description: 'A full-stack platform built with React, Next.js, and PostgreSQL with Docker support',
      topics: ['kubernetes', 'graphql', 'web-development']
    };

    const extracted = repositorySkillExtractor.extractRepositorySkills(mockRepo, 'Additional notes: uses Redis for caching');
    assert(extracted.primarySkills.includes('TypeScript'), 'Extracted TypeScript as primary language');
    assert(extracted.primarySkills.includes('React'), 'Extracted React as primary framework');
    assert(extracted.primarySkills.includes('Next.js'), 'Extracted Next.js as primary framework');
    assert(extracted.secondarySkills.includes('PostgreSQL'), 'Extracted PostgreSQL as secondary storage');
    assert(extracted.secondarySkills.includes('Docker'), 'Extracted Docker as secondary devops');
    assert(extracted.secondarySkills.includes('Kubernetes'), 'Extracted Kubernetes from topics');
    assert(extracted.secondarySkills.includes('GraphQL'), 'Extracted GraphQL from topics');
    assert(extracted.secondarySkills.includes('Redis'), 'Extracted Redis from readme text');
    assert(!extracted.allSkills.includes('web-development'), 'Ignored generic non-taxonomy topic');

    // =========================================================================
    // SECTION 3: Matching Engine Unit Tests
    // =========================================================================
    console.log('\n--- 3. Testing Matching Engine Formulas & Explanations ---');

    const devSkills = [
      { id: '1', userId: 'user-1', skillName: 'TypeScript', proficiency: 'Advanced' as const, createdAt: '', updatedAt: '' },
      { id: '2', userId: 'user-1', skillName: 'React', proficiency: 'Intermediate' as const, createdAt: '', updatedAt: '' },
      { id: '3', userId: 'user-1', skillName: 'Docker', proficiency: 'Beginner' as const, createdAt: '', updatedAt: '' }
    ];

    const matchInput = {
      id: 'repo-1',
      name: 'test-repo',
      fullName: 'org/test-repo',
      extractedSkills: {
        primarySkills: ['TypeScript', 'React'],
        secondarySkills: ['Docker', 'PostgreSQL'],
        allSkills: ['TypeScript', 'React', 'Docker', 'PostgreSQL']
      },
      analysis: {
        id: 'analysis-1',
        repositoryId: 'repo-1',
        fullName: 'org/test-repo',
        scores: {
          overall: 88.0,
          activity: 90.0,
          community: 85.0,
          documentation: 90.0,
          beginner: 80.0,
          maintenance: 90.0
        },
        explanations: {} as any,
        metricsSummary: {} as any,
        isComplete: true,
        lastAnalyzedAt: new Date().toISOString()
      }
    };

    const matchResult = matchingEngineService.calculateMatch(devSkills, matchInput);
    assert(matchResult.matchScore >= 75, `High match score is >= 75 (got ${matchResult.matchScore})`);
    assert(matchResult.breakdown.matchedSkills.length === 3, 'Matched 3 skills: TypeScript, React, Docker');
    assert(matchResult.breakdown.missingSkills.includes('PostgreSQL'), 'Missing skill is PostgreSQL');
    assert(matchResult.breakdown.skillCoverage > 80, `Skill coverage > 80% with primary weighting (got ${matchResult.breakdown.skillCoverage}%)`);
    assert(matchResult.breakdown.repoQualityScore === 88.0, 'Repository quality matches intelligence overall score');
    assert(matchResult.isComplete === true, 'Match result isComplete = true');
    assert(matchResult.breakdown.explanations.length >= 4, 'Human-readable explanations generated');

    // Test Beginner Non-Penalization
    console.log('Testing Beginner Friendly Fit:');
    const beginnerSkills = [
      { id: '1', userId: 'user-b', skillName: 'TypeScript', proficiency: 'Beginner' as const, createdAt: '', updatedAt: '' }
    ];
    const beginnerMatch = matchingEngineService.calculateMatch(beginnerSkills, matchInput);
    assert(beginnerMatch.breakdown.proficiencyFit >= 90, `Beginner proficiency fit on newcomer-friendly repo is >= 90% (got ${beginnerMatch.breakdown.proficiencyFit}%)`);

    // Test Incomplete Data Handling
    const unanalyzedMatch = matchingEngineService.calculateMatch(devSkills, {
      ...matchInput,
      analysis: null
    });
    assert(unanalyzedMatch.isComplete === false, 'Unanalyzed repository sets isComplete = false');
    assert(unanalyzedMatch.breakdown.repoQualityScore === 50.0, 'Unanalyzed repository defaults to 50% neutral quality');

    // =========================================================================
    // SECTION 4: Developer Skill Service & User Isolation Tests
    // =========================================================================
    console.log('\n--- 4. Testing Developer Skill Service & Data Isolation ---');

    // Create User A and User B
    const userA = await prisma.user.create({
      data: {
        githubId: `github_user_a_${Date.now()}`,
        githubUsername: `user_a_${Date.now()}`,
        email: 'user_a@killsoc.dev'
      }
    });
    userAId = userA.id;
    userAToken = signAuthToken({ userId: userA.id, githubId: userA.githubId, username: userA.githubUsername });

    const userB = await prisma.user.create({
      data: {
        githubId: `github_user_b_${Date.now()}`,
        githubUsername: `user_b_${Date.now()}`,
        email: 'user_b@killsoc.dev'
      }
    });
    userBId = userB.id;
    userBToken = signAuthToken({ userId: userB.id, githubId: userB.githubId, username: userB.githubUsername });

    // Add skills for User A
    const skillA1 = await developerSkillService.addSkill(userAId, {
      skillName: 'typescript',
      proficiency: 'Advanced'
    });
    assert(skillA1.skillName === 'TypeScript', 'Skill A1 normalized to TypeScript');
    assert(skillA1.proficiency === 'Advanced', 'Proficiency stored as Advanced');

    // Duplicate skill addition is idempotent and updates proficiency
    const skillA1Dup = await developerSkillService.addSkill(userAId, {
      skillName: 'TypeScript',
      proficiency: 'Intermediate'
    });
    assert(skillA1Dup.id === skillA1.id, 'Duplicate skill returns same record ID');
    assert(skillA1Dup.proficiency === 'Intermediate', 'Duplicate skill updates proficiency');

    // Add skill for User B
    const skillB1 = await developerSkillService.addSkill(userBId, {
      skillName: 'python',
      proficiency: 'Beginner'
    });
    assert(skillB1.skillName === 'Python', 'User B skill created');

    // Isolation check: User A cannot update or delete User B's skill
    let userAIsoUpdateFailed = false;
    try {
      await developerSkillService.updateSkill(userAId, skillB1.id, { proficiency: 'Advanced' });
    } catch {
      userAIsoUpdateFailed = true;
    }
    assert(userAIsoUpdateFailed, 'User A blocked from updating User B skill (404/not found)');

    let userAIsoDeleteFailed = false;
    try {
      await developerSkillService.deleteSkill(userAId, skillB1.id);
    } catch {
      userAIsoDeleteFailed = true;
    }
    assert(userAIsoDeleteFailed, 'User A blocked from deleting User B skill (404/not found)');

    // Bulk update skills for User A
    const bulkResult = await developerSkillService.bulkUpdateSkills(userAId, [
      { skillName: 'React', proficiency: 'Advanced' },
      { skillName: 'Node.js', proficiency: 'Intermediate' },
      { skillName: 'PostgreSQL', proficiency: 'Beginner' }
    ]);
    assert(bulkResult.length === 3, `Bulk updated 3 skills for User A (got ${bulkResult.length})`);

    // =========================================================================
    // SECTION 5: Recommendation Service & Idempotence Tests
    // =========================================================================
    console.log('\n--- 5. Testing Recommendation Generation & Persistence ---');

    // Create a candidate repository in DB
    const candidateRepo = await prisma.repository.create({
      data: {
        githubRepoId: `repo_cand_${Date.now()}`,
        name: 'fullstack-starter',
        fullName: `test-org/fullstack-starter-${Date.now()}`,
        description: 'Starter template using React, Node.js, and PostgreSQL',
        language: 'TypeScript',
        stars: 450,
        forks: 80,
        openIssues: 12,
        topics: ['react', 'nodejs', 'postgresql']
      }
    });
    testRepoId = candidateRepo.id;

    // Attach repository analysis
    await prisma.repositoryAnalysis.create({
      data: {
        repositoryId: testRepoId,
        overallScore: 85.0,
        activityScore: 88.0,
        communityScore: 82.0,
        documentationScore: 90.0,
        beginnerScore: 75.0,
        maintenanceScore: 86.0,
        explanations: {} as any,
        metricsSummary: {} as any,
        isComplete: true
      }
    });

    // Generate recommendations for User A
    const recs = await recommendationService.generateRecommendations(userAId);
    assert(recs.length > 0, `Generated recommendations for User A (got ${recs.length})`);
    const targetRec = recs.find(r => r.repositoryId === testRepoId);
    assert(Boolean(targetRec), 'Recommendation exists for candidate repo');
    assert(targetRec!.matchScore >= 60, `Match score is high (got ${targetRec!.matchScore})`);

    // Test duplicate prevention: re-running does not create duplicate rows
    await recommendationService.generateRecommendations(userAId);
    const recCount = await prisma.recommendation.count({
      where: { userId: userAId, repositoryId: testRepoId }
    });
    assert(recCount === 1, `Exactly 1 recommendation record exists (no duplicate rows, got ${recCount})`);

    // Isolation check: User B has no recommendations yet
    const userBRecs = await recommendationService.getUserRecommendations(userBId);
    assert(userBRecs.data.length === 0, 'User B has 0 recommendations (User A recs isolated)');

    // =========================================================================
    // SECTION 6: HTTP REST API Endpoints Integration Tests
    // =========================================================================
    console.log('\n--- 6. Testing REST API Endpoints ---');

    const testPort = 5099;
    server = app.listen(testPort);
    baseUrl = `http://localhost:${testPort}/api`;

    // 1. GET /api/skills without auth -> 401
    const unauthSkillsRes = await fetch(`${baseUrl}/skills`);
    assert(unauthSkillsRes.status === 401, 'GET /api/skills returns 401 without auth');

    // 2. GET /api/skills with auth -> 200
    const authSkillsRes = await fetch(`${baseUrl}/skills`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${userAToken}` }
    });
    const authSkillsBody = (await authSkillsRes.json()) as any;
    assert(authSkillsRes.status === 200, 'GET /api/skills returns 200 with auth');
    assert(authSkillsBody.data.length === 3, 'Returns User A skills list');

    // 3. POST /api/skills -> 201
    const addSkillRes = await fetch(`${baseUrl}/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${userAToken}`
      },
      body: JSON.stringify({ skillName: 'Docker', proficiency: 'Intermediate' })
    });
    const addSkillBody = (await addSkillRes.json()) as any;
    assert(addSkillRes.status === 201, 'POST /api/skills returns 201');
    assert(addSkillBody.data.skillName === 'Docker', 'Added Docker skill');
    const dockerSkillId = addSkillBody.data.id;

    // 4. PUT /api/skills/:id -> 200
    const updateSkillRes = await fetch(`${baseUrl}/skills/${dockerSkillId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${userAToken}`
      },
      body: JSON.stringify({ proficiency: 'Advanced' })
    });
    const updateSkillBody = (await updateSkillRes.json()) as any;
    assert(updateSkillRes.status === 200, 'PUT /api/skills/:id returns 200');
    assert(updateSkillBody.data.proficiency === 'Advanced', 'Updated proficiency to Advanced');

    // 5. User B attempts to delete User A's skill -> 404
    const crossDeleteRes = await fetch(`${baseUrl}/skills/${dockerSkillId}`, {
      method: 'DELETE',
      headers: { Cookie: `${JWT_COOKIE_NAME}=${userBToken}` }
    });
    assert(crossDeleteRes.status === 404, 'User B blocked from deleting User A skill (404)');

    // 6. DELETE /api/skills/:id -> 200
    const deleteSkillRes = await fetch(`${baseUrl}/skills/${dockerSkillId}`, {
      method: 'DELETE',
      headers: { Cookie: `${JWT_COOKIE_NAME}=${userAToken}` }
    });
    assert(deleteSkillRes.status === 200, 'DELETE /api/skills/:id returns 200');

    // 7. POST /api/matching/generate -> 200
    const genRecRes = await fetch(`${baseUrl}/matching/generate`, {
      method: 'POST',
      headers: { Cookie: `${JWT_COOKIE_NAME}=${userAToken}` }
    });
    const genRecBody = (await genRecRes.json()) as any;
    assert(genRecRes.status === 200, 'POST /api/matching/generate returns 200');
    assert(Array.isArray(genRecBody.data), 'Returns recommendations array');

    // 8. GET /api/matching/recommendations -> 200
    const getRecsRes = await fetch(`${baseUrl}/matching/recommendations?perPage=10`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${userAToken}` }
    });
    const getRecsBody = (await getRecsRes.json()) as any;
    assert(getRecsRes.status === 200, 'GET /api/matching/recommendations returns 200');
    assert(getRecsBody.data.length > 0, 'Retrieved recommendations');
    assert(Boolean(getRecsBody.pagination), 'Pagination metadata included');

    const firstRecId = getRecsBody.data[0].id;

    // 9. GET /api/matching/recommendations/:id -> 200
    const getRecDetailRes = await fetch(`${baseUrl}/matching/recommendations/${firstRecId}`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${userAToken}` }
    });
    const getRecDetailBody = (await getRecDetailRes.json()) as any;
    assert(getRecDetailRes.status === 200, 'GET /api/matching/recommendations/:id returns 200');
    assert(Boolean(getRecDetailBody.data.repository), 'Repository details attached');

    // 10. User B attempts to access User A's recommendation -> 404
    const crossRecRes = await fetch(`${baseUrl}/matching/recommendations/${firstRecId}`, {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${userBToken}` }
    });
    assert(crossRecRes.status === 404, 'User B blocked from accessing User A recommendation (404)');

    console.log('\n🎉 ALL TASK 06 TESTS PASSED SUCCESSFULLY! ✅\n');
  } finally {
    // Cleanup database records
    if (userAId || userBId) {
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId].filter(Boolean) } }
      });
    }
    if (testRepoId) {
      await prisma.repository.deleteMany({
        where: { id: testRepoId }
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
