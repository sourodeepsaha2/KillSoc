import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import {
  normalizeSkillName,
  normalizeProficiency,
  isValidProficiency
} from './skill-taxonomy.js';
import type { DeveloperSkillDTO, ProficiencyLevel } from '../../types/index.js';

export class DeveloperSkillService {
  /**
   * Retrieves all technical skills for an authenticated user.
   */
  async getUserSkills(userId: string): Promise<DeveloperSkillDTO[]> {
    const skills = await prisma.developerSkill.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });

    return skills.map(s => ({
      id: s.id,
      userId: s.userId,
      skillName: s.skillName,
      proficiency: s.proficiency as ProficiencyLevel,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString()
    }));
  }

  /**
   * Adds a technical skill for the user. If the normalized skill already exists,
   * updates its proficiency level idempotently to prevent duplicate errors.
   */
  async addSkill(
    userId: string,
    input: { skillName: string; proficiency?: string }
  ): Promise<DeveloperSkillDTO> {
    if (!input.skillName || typeof input.skillName !== 'string' || !input.skillName.trim()) {
      throw ApiError.badRequest('Skill name is required and must be a non-empty string');
    }

    if (input.proficiency && !isValidProficiency(input.proficiency)) {
      throw ApiError.badRequest(
        'Invalid proficiency level. Allowed values: Beginner, Intermediate, Advanced'
      );
    }

    const normalizedName = normalizeSkillName(input.skillName);
    const proficiency = normalizeProficiency(input.proficiency);

    // Upsert skill by unique [userId, skillName]
    const skill = await prisma.developerSkill.upsert({
      where: {
        userId_skillName: {
          userId,
          skillName: normalizedName
        }
      },
      update: {
        proficiency
      },
      create: {
        userId,
        skillName: normalizedName,
        proficiency
      }
    });

    return {
      id: skill.id,
      userId: skill.userId,
      skillName: skill.skillName,
      proficiency: skill.proficiency as ProficiencyLevel,
      createdAt: skill.createdAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString()
    };
  }

  /**
   * Updates an existing skill and/or proficiency for the user with ownership verification.
   */
  async updateSkill(
    userId: string,
    skillId: string,
    input: { skillName?: string; proficiency?: string }
  ): Promise<DeveloperSkillDTO> {
    // 1. Verify existence and ownership
    const existing = await prisma.developerSkill.findFirst({
      where: { id: skillId, userId }
    });

    if (!existing) {
      throw ApiError.notFound('Skill not found in your profile');
    }

    let normalizedName = existing.skillName;
    if (input.skillName !== undefined) {
      if (typeof input.skillName !== 'string' || !input.skillName.trim()) {
        throw ApiError.badRequest('Skill name must be a non-empty string');
      }
      normalizedName = normalizeSkillName(input.skillName);

      // Check if another skill with this normalized name already exists
      if (normalizedName !== existing.skillName) {
        const duplicate = await prisma.developerSkill.findUnique({
          where: {
            userId_skillName: {
              userId,
              skillName: normalizedName
            }
          }
        });
        if (duplicate) {
          throw ApiError.badRequest(
            `You already have "${normalizedName}" in your skill profile`
          );
        }
      }
    }

    let proficiency = existing.proficiency as ProficiencyLevel;
    if (input.proficiency !== undefined) {
      if (!isValidProficiency(input.proficiency)) {
        throw ApiError.badRequest(
          'Invalid proficiency level. Allowed values: Beginner, Intermediate, Advanced'
        );
      }
      proficiency = normalizeProficiency(input.proficiency);
    }

    const updated = await prisma.developerSkill.update({
      where: { id: skillId },
      data: {
        skillName: normalizedName,
        proficiency
      }
    });

    return {
      id: updated.id,
      userId: updated.userId,
      skillName: updated.skillName,
      proficiency: updated.proficiency as ProficiencyLevel,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  /**
   * Deletes a skill with strict user data isolation.
   */
  async deleteSkill(userId: string, skillId: string): Promise<void> {
    const existing = await prisma.developerSkill.findFirst({
      where: { id: skillId, userId }
    });

    if (!existing) {
      throw ApiError.notFound('Skill not found in your profile');
    }

    await prisma.developerSkill.delete({
      where: { id: skillId }
    });
  }

  /**
   * Bulk replaces the user's skills with a new set, normalizing and deduplicating names.
   */
  async bulkUpdateSkills(
    userId: string,
    skillsInput: Array<{ skillName: string; proficiency?: string }>
  ): Promise<DeveloperSkillDTO[]> {
    if (!Array.isArray(skillsInput)) {
      throw ApiError.badRequest('Skills payload must be an array');
    }

    // Deduplicate and normalize input
    const dedupedMap = new Map<string, ProficiencyLevel>();

    for (const item of skillsInput) {
      if (!item.skillName || typeof item.skillName !== 'string' || !item.skillName.trim()) {
        continue;
      }

      if (item.proficiency && !isValidProficiency(item.proficiency)) {
        throw ApiError.badRequest(
          `Invalid proficiency level "${item.proficiency}" for skill "${item.skillName}". Allowed values: Beginner, Intermediate, Advanced`
        );
      }

      const normalized = normalizeSkillName(item.skillName);
      const proficiency = normalizeProficiency(item.proficiency);
      dedupedMap.set(normalized, proficiency);
    }

    // Atomically replace all user skills
    await prisma.$transaction(async tx => {
      await tx.developerSkill.deleteMany({
        where: { userId }
      });

      if (dedupedMap.size > 0) {
        const createData = Array.from(dedupedMap.entries()).map(([skillName, proficiency]) => ({
          userId,
          skillName,
          proficiency
        }));

        await tx.developerSkill.createMany({
          data: createData
        });
      }
    });

    return this.getUserSkills(userId);
  }
}

export const developerSkillService = new DeveloperSkillService();
