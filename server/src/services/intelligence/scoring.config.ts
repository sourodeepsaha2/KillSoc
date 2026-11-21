export interface ScoringWeights {
  activity: number;
  maintenance: number;
  community: number;
  documentation: number;
  beginner: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  archivedScoreCap: number;
  cacheTtlHours: number;
  beginnerLabelPatterns: string[];
}

export const SCORING_CONFIG: ScoringConfig = {
  weights: {
    activity: 0.25,
    maintenance: 0.25,
    community: 0.20,
    documentation: 0.15,
    beginner: 0.15
  },
  archivedScoreCap: 20.0,
  cacheTtlHours: 24,
  beginnerLabelPatterns: [
    'good first issue',
    'good-first-issue',
    'good_first_issue',
    'beginner',
    'beginner-friendly',
    'easy',
    'help wanted',
    'help-wanted',
    'starter',
    'first-timers-only',
    'first timers only',
    'up-for-grabs',
    'up for grabs',
    'low-hanging-fruit'
  ]
};

/**
 * Checks whether an issue label matches any beginner-friendly pattern.
 */
export function isBeginnerLabel(labelName: string): boolean {
  const normalized = labelName.trim().toLowerCase();
  return SCORING_CONFIG.beginnerLabelPatterns.some(pattern =>
    normalized === pattern || normalized.includes(pattern)
  );
}
