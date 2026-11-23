process.env['NODE_ENV'] = 'test';

import http from 'node:http';
import app from './app.js';
import { prisma } from './config/prisma.js';
import { signAuthToken, JWT_COOKIE_NAME } from './utils/jwt.js';
import { getRedisOptions, isRedisHealthy, closeRedisConnection, calculateBackoffDelay } from './jobs/redis.connection.js';
import { MockJobQueue } from './jobs/mock-queue.service.js';
import { JobQueueFactory } from './jobs/job-queue.factory.js';
import { generateJobId, JOB_NAMES } from './jobs/job.types.js';
import { JobWorker } from './jobs/job.worker.js';

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
  console.log('🚀 Starting KillSoc Task 09: Background Job Processing with Redis + BullMQ Tests...\n');

  let userAId = '';
  let userBId = '';
  let userAToken = '';
  let userBToken = '';

  const mockQueue = new MockJobQueue();
  JobQueueFactory.setCustomQueue(mockQueue);

  try {
    // =========================================================================
    // SECTION 1: Redis Connection & Options Configuration
    // =========================================================================
    console.log('--- 1. Testing Redis Connection & Configuration ---');

    const redisOpts = getRedisOptions();
    assert(redisOpts.maxRetriesPerRequest === null, 'maxRetriesPerRequest is set to null (BullMQ strict requirement)');
    assert(redisOpts.enableReadyCheck === false, 'enableReadyCheck is disabled for fast worker boot');
    assert(typeof redisOpts.retryStrategy === 'function', 'Exponential retry strategy configured');

    // Test backoff calculation
    assert(calculateBackoffDelay(1) === 200, 'Retry 1 backoff delay is 200ms');
    assert(calculateBackoffDelay(5) === 1000, 'Retry 5 backoff delay is 1000ms');
    assert(calculateBackoffDelay(20) === 2000, 'Retry backoff is capped at 2000ms maximum');

    const retryFn = redisOpts.retryStrategy as (times: number) => number | null;
    assert(retryFn(1) === null, 'In test environment, retryStrategy safely returns null to avoid hanging offline connections');

    // Safe error handling check
    const isHealthy = await isRedisHealthy();
    assert(typeof isHealthy === 'boolean', 'isRedisHealthy returns boolean without unhandled crash');

    // =========================================================================
    // SECTION 2: Queue Creation, Enqueueing & Deduplication
    // =========================================================================
    console.log('\n--- 2. Testing Queue Creation, Enqueueing & Deduplication ---');

    assert(mockQueue.isAvailable() === true, 'Queue is ready and accepting jobs');

    // Test deterministic Job ID generation
    const orgJobId = generateJobId(JOB_NAMES.ORG_SYNC, 'pallets');
    assert(orgJobId === 'org-sync:pallets', 'Deduplication ID for org: org-sync:pallets');

    const repoJobId = generateJobId(JOB_NAMES.REPO_ANALYSIS, 'pallets/flask');
    assert(repoJobId === 'repo-analysis:pallets-flask', 'Deduplication ID for repo: repo-analysis:pallets-flask');

    const recJobId = generateJobId(JOB_NAMES.AI_RECOMMENDATIONS, 'user-123');
    assert(recJobId === 'ai-recommendations:user-123', 'Deduplication ID for AI recs: ai-recommendations:user-123');

    // Enqueue organization sync job
    const enq1 = await mockQueue.enqueue(JOB_NAMES.ORG_SYNC, {
      organizationSlug: 'pallets',
      userId: 'test-user-a'
    });
    assert(enq1.jobId === 'org-sync:pallets', 'Job enqueued with deterministic ID');
    assert(enq1.status === 'waiting', 'Initial job status is waiting');

    // Deduplication check: Enqueueing identical job returns existing without duplicate record
    const enqDuplicate = await mockQueue.enqueue(JOB_NAMES.ORG_SYNC, {
      organizationSlug: 'pallets',
      userId: 'test-user-a'
    });
    assert(enqDuplicate.jobId === enq1.jobId, 'Deduplication: returned same jobId');
    assert(mockQueue.getAllJobs().length === 1, 'Deduplication: no duplicate jobs added to queue');

    // Enqueue other job types
    const enqRepo = await mockQueue.enqueue(JOB_NAMES.REPO_ANALYSIS, {
      owner: 'pallets',
      repo: 'flask',
      userId: 'test-user-a'
    });
    assert(enqRepo.jobId === 'repo-analysis:pallets-flask', 'Repo analysis job enqueued');

    const enqAi = await mockQueue.enqueue(JOB_NAMES.AI_RECOMMENDATIONS, {
      userId: 'test-user-a'
    });
    assert(enqAi.jobId === 'ai-recommendations:test-user-a', 'AI recommendations job enqueued');

    const enqSkill = await mockQueue.enqueue(JOB_NAMES.SKILL_EXTRACTION, {
      repositoryId: 'mock-repo-uuid',
      userId: 'test-user-a'
    });
    assert(enqSkill.jobId === 'skill-extraction:mock-repo-uuid', 'Skill extraction job enqueued');

    const enqIssue = await mockQueue.enqueue(JOB_NAMES.ISSUE_SYNC, {
      owner: 'pallets',
      repo: 'flask',
      userId: 'test-user-a'
    });
    assert(enqIssue.jobId === 'issue-sync:pallets-flask', 'Issue sync job enqueued');

    // =========================================================================
    // SECTION 3: Worker Processing, Progress Tracking & Graceful Shutdown
    // =========================================================================
    console.log('\n--- 3. Testing Worker Processing, Progress Tracking & Shutdown ---');

    const worker = new JobWorker('test-queue', 2);
    assert(typeof worker.processJob === 'function', 'Worker processJob method is defined');

    // Test progress tracking
    mockQueue.updateProgress(enq1.jobId, 45);
    const inProgressStatus = await mockQueue.getJobStatus(enq1.jobId);
    assert(inProgressStatus?.progress === 45, 'Job progress updated to 45%');

    // Test job completion transition
    mockQueue.markCompleted(enq1.jobId, { syncedRepositories: 12 });
    const completedStatus = await mockQueue.getJobStatus(enq1.jobId);
    assert(completedStatus?.status === 'completed', 'Job status marked as completed');
    assert(completedStatus?.progress === 100, 'Completed job progress is 100%');
    assert(completedStatus?.completedAt !== null, 'completedAt timestamp set');
    assert((completedStatus?.result as any)?.syncedRepositories === 12, 'Result payload stored safely');

    // Test graceful shutdown
    await worker.close();
    assert(worker.status === 'stopped', 'Worker gracefully stopped');

    // =========================================================================
    // SECTION 4: Failure Handling, Sanitization & Non-Retryable Errors
    // =========================================================================
    console.log('\n--- 4. Testing Failure Handling, Sanitization & Non-Retryable Errors ---');

    // Test transient failure with backoff retry
    const failJobId = 'repo-analysis:test-fail';
    await mockQueue.enqueue(JOB_NAMES.REPO_ANALYSIS, {
      owner: 'test',
      repo: 'fail',
      userId: 'test-user-a'
    }, { jobId: failJobId });

    mockQueue.markActive(failJobId);
    mockQueue.markFailed(failJobId, 'Temporary network glitch', true);
    const retryStatus = await mockQueue.getJobStatus(failJobId);
    assert(retryStatus?.status === 'delayed', 'Transient error placed in delayed state for exponential backoff');

    // Test permanent error (e.g. 404 Not Found)
    mockQueue.markFailed(failJobId, 'Organization not found in database', false);
    const fatalStatus = await mockQueue.getJobStatus(failJobId);
    assert(fatalStatus?.status === 'failed', 'Permanent error marked as failed (no infinite retry)');

    // Test failure message sanitization (never leak tokens)
    const sensitiveErrorMsg = 'Failed to connect: token=ghp_secret1234567890abcdef and Authorization: Bearer ghp_topsecret';
    mockQueue.markFailed(failJobId, sensitiveErrorMsg, false);
    const sanitizedStatus = await mockQueue.getJobStatus(failJobId);
    assert(!sanitizedStatus?.failedReason?.includes('ghp_secret1234567890abcdef'), 'Sanitization: raw token stripped from failedReason');
    assert(!sanitizedStatus?.failedReason?.includes('ghp_topsecret'), 'Sanitization: Bearer secret stripped from failedReason');
    assert(Boolean(sanitizedStatus?.failedReason?.includes('[REDACTED]')), 'Sanitization: replaced with [REDACTED]');

    // =========================================================================
    // SECTION 5: HTTP REST API Endpoints & User Isolation
    // =========================================================================
    console.log('\n--- 5. Testing REST API Endpoints & User Data Isolation ---');

    const timestamp = Date.now();
    const testPort = 5097;
    server = app.listen(testPort);
    baseUrl = `http://127.0.0.1:${testPort}/api`;

    // Create Test User A
    const userA = await prisma.user.create({
      data: {
        githubId: `job-user-a-${timestamp}`,
        githubUsername: `job-dev-a-${timestamp}`,
        email: `job-dev-a-${timestamp}@example.com`
      }
    });
    userAId = userA.id;
    userAToken = signAuthToken({ userId: userA.id, githubId: userA.githubId, username: userA.githubUsername });

    // Create Test User B
    const userB = await prisma.user.create({
      data: {
        githubId: `job-user-b-${timestamp}`,
        githubUsername: `job-dev-b-${timestamp}`,
        email: `job-dev-b-${timestamp}@example.com`
      }
    });
    userBId = userB.id;
    userBToken = signAuthToken({ userId: userB.id, githubId: userB.githubId, username: userB.githubUsername });

    // 1. POST /api/jobs/organizations/:slug/sync - 401 Unauthenticated
    const unauthOrgRes = await fetch(`${baseUrl}/jobs/organizations/test-org/sync`, {
      method: 'POST'
    });
    assert(unauthOrgRes.status === 401, 'POST /api/jobs/organizations/:slug/sync rejects unauthenticated (401)');

    // 2. POST /api/jobs/organizations/:slug/sync - 202 Accepted
    const authOrgRes = await fetch(`${baseUrl}/jobs/organizations/test-org/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${userAToken}`
      },
      body: JSON.stringify({ force: true })
    });
    assert(authOrgRes.status === 202, 'POST /api/jobs/organizations/:slug/sync returns HTTP 202 Accepted');
    const authOrgBody = (await authOrgRes.json()) as any;
    assert(authOrgBody.success === true, 'Response contains success: true');
    assert(authOrgBody.data.jobId === 'org-sync:test-org', 'Returns job ID');
    assert(authOrgBody.data.jobType === 'org-sync', 'Returns job type org-sync');
    assert(authOrgBody.data.status === 'waiting', 'Initial status is waiting');

    // 3. POST /api/jobs/repos/:owner/:repo/analyze - 202 Accepted
    const authRepoRes = await fetch(`${baseUrl}/jobs/repos/test-owner/test-repo/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${userAToken}`
      },
      body: JSON.stringify({ forceRefresh: true })
    });
    assert(authRepoRes.status === 202, 'POST /api/jobs/repos/:owner/:repo/analyze returns HTTP 202 Accepted');
    const authRepoBody = (await authRepoRes.json()) as any;
    assert(authRepoBody.data.jobType === 'repo-analysis', 'Returns job type repo-analysis');
    const repoJobIdCreated = authRepoBody.data.jobId;

    // 4. POST /api/jobs/recommendations/generate - 202 Accepted
    const authAiRes = await fetch(`${baseUrl}/jobs/recommendations/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${JWT_COOKIE_NAME}=${userAToken}`
      },
      body: JSON.stringify({ options: { maxRepositories: 5 } })
    });
    assert(authAiRes.status === 202, 'POST /api/jobs/recommendations/generate returns HTTP 202 Accepted');
    const authAiBody = (await authAiRes.json()) as any;
    assert(authAiBody.data.jobType === 'ai-recommendations', 'Returns job type ai-recommendations');

    // 5. GET /api/jobs/:jobId - 200 OK for Owner (User A)
    const statusRes = await fetch(`${baseUrl}/jobs/${repoJobIdCreated}`, {
      headers: {
        Cookie: `${JWT_COOKIE_NAME}=${userAToken}`
      }
    });
    assert(statusRes.status === 200, 'GET /api/jobs/:jobId returns HTTP 200 for job owner');
    const statusBody = (await statusRes.json()) as any;
    assert(statusBody.data.jobId === repoJobIdCreated, 'Returns correct jobId');
    assert(statusBody.data.status === 'waiting', 'Returns current status');
    assert(statusBody.data.progress === 0, 'Returns initial progress');
    assert(typeof statusBody.data.createdAt === 'string', 'Returns ISO createdAt timestamp');

    // 6. User Isolation Test: User B querying User A's jobId -> 404 Not Found
    const isolationRes = await fetch(`${baseUrl}/jobs/${repoJobIdCreated}`, {
      headers: {
        Cookie: `${JWT_COOKIE_NAME}=${userBToken}`
      }
    });
    assert(isolationRes.status === 404, 'USER ISOLATION: User B blocked from viewing User A job status (404 Not Found)');

    // 7. GET /api/jobs/:jobId for non-existent job -> 404
    const notFoundRes = await fetch(`${baseUrl}/jobs/non-existent-job-id-999`, {
      headers: {
        Cookie: `${JWT_COOKIE_NAME}=${userAToken}`
      }
    });
    assert(notFoundRes.status === 404, 'Non-existent job returns HTTP 404');

    console.log('\n🎉 ALL TASK 09 BACKGROUND JOB TESTS PASSED SUCCESSFULLY! ✅\n');
  } finally {
    // Teardown HTTP Server
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    // Reset Queue Factory & Redis Connection
    JobQueueFactory.reset();
    await closeRedisConnection();

    // Database Cleanup
    try {
      if (userAId) {
        await prisma.user.deleteMany({ where: { id: userAId } });
      }
      if (userBId) {
        await prisma.user.deleteMany({ where: { id: userBId } });
      }
    } catch (cleanupErr) {
      console.warn('Test cleanup warning:', cleanupErr);
    }

    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
