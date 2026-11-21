import { MATCHING_CONFIG, MatchingConfig } from './matching.config.js';
import type {
  DeveloperSkillDTO,
  ExtractedRepoSkills,
  MatchCalculationResult,
  MatchBreakdown,
  RepositoryAnalysisDTO
} from '../../types/index.js';

export interface RepositoryMatchingInput {
  id: string;
  name: string;
  fullName: string;
  extractedSkills: ExtractedRepoSkills;
  analysis?: RepositoryAnalysisDTO | null;
}

export class MatchingEngineService {
  constructor(private readonly config: MatchingConfig = MATCHING_CONFIG) {}

  /**
   * Helper to round float scores to 1 decimal place within [0, 100].
   */
  private round(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }

  /**
   * Calculates deterministic, explainable repository match score for a developer.
   */
  calculateMatch(
    developerSkills: DeveloperSkillDTO[],
    repo: RepositoryMatchingInput
  ): MatchCalculationResult {
    const explanations: string[] = [];
    let isComplete = true;

    // 1. Build developer skill map
    const devSkillMap = new Map<string, DeveloperSkillDTO>();
    for (const skill of developerSkills) {
      devSkillMap.set(skill.skillName.toLowerCase(), skill);
    }

    const { primarySkills, secondarySkills, allSkills } = repo.extractedSkills;

    // 2. Skill Coverage Calculation
    const matchedPrimary: string[] = [];
    const matchedSecondary: string[] = [];
    const missingSkills: string[] = [];

    for (const skill of primarySkills) {
      if (devSkillMap.has(skill.toLowerCase())) {
        matchedPrimary.push(skill);
      } else {
        missingSkills.push(skill);
      }
    }

    for (const skill of secondarySkills) {
      if (devSkillMap.has(skill.toLowerCase())) {
        matchedSecondary.push(skill);
      } else {
        missingSkills.push(skill);
      }
    }

    const matchedSkills = [...matchedPrimary, ...matchedSecondary];

    let skillCoverage = 0;
    const totalRequiredWeight =
      primarySkills.length * this.config.primarySkillWeight +
      secondarySkills.length * this.config.secondarySkillWeight;

    if (totalRequiredWeight > 0) {
      const matchedWeight =
        matchedPrimary.length * this.config.primarySkillWeight +
        matchedSecondary.length * this.config.secondarySkillWeight;
      skillCoverage = this.round((matchedWeight / totalRequiredWeight) * 100);

      explanations.push(
        `Skill Coverage: ${skillCoverage}% (${matchedSkills.length}/${allSkills.length} detected technologies matched).`
      );
    } else {
      // Repository has no detected technologies
      skillCoverage = 50.0;
      isComplete = false;
      explanations.push(
        'Skill Coverage: Neutral (50%) - Repository lacks detected technology metadata.'
      );
    }

    if (matchedSkills.length > 0) {
      explanations.push(`Matched technologies: ${matchedSkills.join(', ')}.`);
    }
    if (missingSkills.length > 0) {
      explanations.push(`Technologies to learn: ${missingSkills.join(', ')}.`);
    }

    // 3. Proficiency Fit Calculation
    let proficiencyFit = 0;
    const beginnerScore = repo.analysis?.scores?.beginner ?? 50;

    if (matchedSkills.length === 0) {
      proficiencyFit = 35.0;
      explanations.push('Proficiency Fit: 35% - No direct skill overlap to assess proficiency.');
    } else {
      let proficiencySum = 0;
      for (const skillName of matchedSkills) {
        const devSkill = devSkillMap.get(skillName.toLowerCase());
        const level = devSkill?.proficiency || 'Intermediate';

        if (level === 'Advanced') {
          proficiencySum += 100;
        } else if (level === 'Intermediate') {
          proficiencySum += 85;
        } else {
          // Beginner level: adjust based on repo's beginner friendliness without punitive penalties
          if (beginnerScore >= 60) {
            proficiencySum += 95; // Newcomer-friendly repo is an ideal fit
          } else if (beginnerScore >= 30) {
            proficiencySum += 80;
          } else {
            proficiencySum += 65; // Moderate fit, learning curve present
          }
        }
      }

      proficiencyFit = this.round(proficiencySum / matchedSkills.length);

      if (developerSkills.some(s => s.proficiency === 'Beginner') && beginnerScore >= 60) {
        explanations.push(
          `Proficiency Fit: ${proficiencyFit}% - High fit for beginners; repository is welcoming with newcomer issues.`
        );
      } else {
        explanations.push(
          `Proficiency Fit: ${proficiencyFit}% - Developer proficiency aligns well with matched technologies.`
        );
      }
    }

    // 4. Repository Quality Calculation
    let repoQualityScore = 50.0;
    if (repo.analysis?.scores?.overall !== undefined) {
      repoQualityScore = repo.analysis.scores.overall;
      explanations.push(
        `Repository Quality: ${repoQualityScore}/100 from Repository Intelligence Engine.`
      );
    } else {
      isComplete = false;
      explanations.push(
        'Repository Quality: 50/100 (Unanalyzed) - Repository intelligence report not yet generated.'
      );
    }

    // 5. Final Match Score Calculation
    const weights = this.config.weights;
    const weightedScore =
      skillCoverage * weights.skillCoverage +
      proficiencyFit * weights.proficiencyFit +
      repoQualityScore * weights.repositoryQuality;

    const matchScore = this.round(weightedScore);
    explanations.push(
      `Final Match Score: ${matchScore}/100 (Coverage: ${Math.round(weights.skillCoverage * 100)}%, Fit: ${Math.round(weights.proficiencyFit * 100)}%, Quality: ${Math.round(weights.repositoryQuality * 100)}%).`
    );

    const breakdown: MatchBreakdown = {
      skillCoverage,
      proficiencyFit,
      repoQualityScore,
      matchedSkills,
      missingSkills,
      explanations
    };

    return {
      matchScore,
      breakdown,
      isComplete
    };
  }
}

export const matchingEngineService = new MatchingEngineService();
