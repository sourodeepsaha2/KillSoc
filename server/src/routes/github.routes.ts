import { Router } from 'express';
import {
  getOrganization,
  getOrganizationRepos,
  syncOrganization,
  getRepository,
  getRepositoryContributors,
  getRepositoryCommits,
  syncRepository
} from '../controllers/github.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

// Organization routes
router.get('/organizations/:name', optionalAuth, asyncHandler(getOrganization));
router.get('/organizations/:name/repos', optionalAuth, asyncHandler(getOrganizationRepos));
router.post('/organizations/:name/sync', requireAuth, asyncHandler(syncOrganization));

// Repository routes
router.get('/repos/:owner/:repo', optionalAuth, asyncHandler(getRepository));
router.get('/repos/:owner/:repo/contributors', optionalAuth, asyncHandler(getRepositoryContributors));
router.get('/repos/:owner/:repo/commits', optionalAuth, asyncHandler(getRepositoryCommits));
router.post('/repos/:owner/:repo/sync', requireAuth, asyncHandler(syncRepository));

export default router;
