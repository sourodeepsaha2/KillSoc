import { Router } from 'express';
import {
  getSkills,
  addSkill,
  updateSkill,
  deleteSkill,
  bulkUpdateSkills
} from '../controllers/skill.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

// Developer Skill Profile Routes
router.get('/', requireAuth, asyncHandler(getSkills));
router.post('/', requireAuth, asyncHandler(addSkill));
router.put('/bulk', requireAuth, asyncHandler(bulkUpdateSkills));
router.put('/:id', requireAuth, asyncHandler(updateSkill));
router.delete('/:id', requireAuth, asyncHandler(deleteSkill));

export default router;
