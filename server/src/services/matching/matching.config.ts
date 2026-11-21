export interface MatchingWeights {
  skillCoverage: number;
  proficiencyFit: number;
  repositoryQuality: number;
}

export interface MatchingConfig {
  weights: MatchingWeights;
  primarySkillWeight: number;
  secondarySkillWeight: number;
  minRecommendedScore: number;
}

export const MATCHING_CONFIG: MatchingConfig = {
  weights: {
    skillCoverage: 0.45,
    proficiencyFit: 0.25,
    repositoryQuality: 0.30
  },
  primarySkillWeight: 2.0,
  secondarySkillWeight: 1.0,
  minRecommendedScore: 30.0
};
