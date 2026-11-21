import type { Request, Response } from 'express';
import { developerSkillService } from '../services/matching/developer-skill.service.js';
import { ApiError } from '../utils/apiError.js';

export async function getSkills(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const skills = await developerSkillService.getUserSkills(userId);

  res.status(200).json({
    success: true,
    data: skills
  });
}

export async function addSkill(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { skillName, proficiency } = req.body;

  if (!skillName) {
    throw ApiError.badRequest('skillName is required');
  }

  const skill = await developerSkillService.addSkill(userId, { skillName, proficiency });

  res.status(201).json({
    success: true,
    message: 'Skill added successfully',
    data: skill
  });
}

export async function updateSkill(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { skillName, proficiency } = req.body;

  if (!id) {
    throw ApiError.badRequest('Skill id parameter is required');
  }

  const skill = await developerSkillService.updateSkill(userId, id, {
    skillName,
    proficiency
  });

  res.status(200).json({
    success: true,
    message: 'Skill updated successfully',
    data: skill
  });
}

export async function deleteSkill(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;

  if (!id) {
    throw ApiError.badRequest('Skill id parameter is required');
  }

  await developerSkillService.deleteSkill(userId, id);

  res.status(200).json({
    success: true,
    message: 'Skill deleted successfully'
  });
}

export async function bulkUpdateSkills(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const skillsPayload = Array.isArray(req.body) ? req.body : req.body?.skills;

  if (!Array.isArray(skillsPayload)) {
    throw ApiError.badRequest(
      'Request body must be an array of skills or an object with a "skills" array'
    );
  }

  const skills = await developerSkillService.bulkUpdateSkills(userId, skillsPayload);

  res.status(200).json({
    success: true,
    message: 'Skills updated successfully',
    data: skills
  });
}
