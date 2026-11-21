import { normalizeSkillName, SKILL_TAXONOMY } from './skill-taxonomy.js';
import type { GitHubRepoDTO, ExtractedRepoSkills } from '../../types/index.js';

// Pre-compiled set of all known taxonomy canonical skills for fast lookup
const ALL_TAXONOMY_SKILLS = new Set(
  SKILL_TAXONOMY.flatMap(c => c.skills.map(s => s.toLowerCase()))
);

// Categorized set of primary skills (languages and major application frameworks)
const PRIMARY_SKILL_NAMES = new Set([
  'javascript',
  'typescript',
  'python',
  'java',
  'c++',
  'c',
  'c#',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'dart',
  'scala',
  'react',
  'next.js',
  'node.js',
  'express',
  'django',
  'fastapi',
  'flask',
  'spring boot',
  'ruby on rails',
  'vue.js',
  'angular',
  'flutter',
  'react native'
]);

// Explicit deterministic regex patterns for description and documentation
const DETERMINISTIC_TECH_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  // Frameworks
  { pattern: /\b(react|reactjs|react\.js)\b/i, canonical: 'React' },
  { pattern: /\b(nextjs|next\.js)\b/i, canonical: 'Next.js' },
  { pattern: /\b(vue|vuejs|vue\.js)\b/i, canonical: 'Vue.js' },
  { pattern: /\b(angular|angularjs)\b/i, canonical: 'Angular' },
  { pattern: /\b(node|nodejs|node\.js)\b/i, canonical: 'Node.js' },
  { pattern: /\b(express|expressjs|express\.js)\b/i, canonical: 'Express' },
  { pattern: /\b(nestjs|nest\.js)\b/i, canonical: 'NestJS' },
  { pattern: /\b(django)\b/i, canonical: 'Django' },
  { pattern: /\b(fastapi)\b/i, canonical: 'FastAPI' },
  { pattern: /\b(flask)\b/i, canonical: 'Flask' },
  { pattern: /\b(spring-?boot)\b/i, canonical: 'Spring Boot' },
  { pattern: /\b(rails|ruby on rails)\b/i, canonical: 'Ruby on Rails' },
  { pattern: /\b(flutter)\b/i, canonical: 'Flutter' },
  { pattern: /\b(react-?native)\b/i, canonical: 'React Native' },
  { pattern: /\b(svelte)\b/i, canonical: 'Svelte' },

  // Databases
  { pattern: /\b(postgres(ql)?|pg)\b/i, canonical: 'PostgreSQL' },
  { pattern: /\b(mongodb|mongo)\b/i, canonical: 'MongoDB' },
  { pattern: /\b(redis)\b/i, canonical: 'Redis' },
  { pattern: /\b(mysql)\b/i, canonical: 'MySQL' },
  { pattern: /\b(sqlite3?)\b/i, canonical: 'SQLite' },
  { pattern: /\b(cassandra)\b/i, canonical: 'Cassandra' },
  { pattern: /\b(dynamodb)\b/i, canonical: 'DynamoDB' },
  { pattern: /\b(elasticsearch)\b/i, canonical: 'Elasticsearch' },

  // DevOps & Cloud
  { pattern: /\b(docker)\b/i, canonical: 'Docker' },
  { pattern: /\b(kubernetes|k8s)\b/i, canonical: 'Kubernetes' },
  { pattern: /\b(aws|amazon web services)\b/i, canonical: 'AWS' },
  { pattern: /\b(google cloud|gcp)\b/i, canonical: 'Google Cloud' },
  { pattern: /\b(azure)\b/i, canonical: 'Azure' },
  { pattern: /\b(terraform)\b/i, canonical: 'Terraform' },
  { pattern: /\b(github-?actions)\b/i, canonical: 'GitHub Actions' },
  { pattern: /\b(nginx)\b/i, canonical: 'Nginx' },

  // AI & Data
  { pattern: /\b(pytorch|torch)\b/i, canonical: 'PyTorch' },
  { pattern: /\b(tensorflow|tf)\b/i, canonical: 'TensorFlow' },
  { pattern: /\b(pandas)\b/i, canonical: 'Pandas' },
  { pattern: /\b(numpy)\b/i, canonical: 'NumPy' },
  { pattern: /\b(deep-?\s*learning)\b/i, canonical: 'Deep Learning' },
  { pattern: /\b(machine-?\s*learning)\b/i, canonical: 'Machine Learning' },
  { pattern: /\b(natural language processing|nlp)\b/i, canonical: 'NLP' },
  { pattern: /\b(computer vision)\b/i, canonical: 'Computer Vision' },

  // Concepts
  { pattern: /\b(graphql|gql)\b/i, canonical: 'GraphQL' },
  { pattern: /\b(rest(ful)?(\s*apis?)?)\b/i, canonical: 'REST APIs' },
  { pattern: /\b(websockets?)\b/i, canonical: 'WebSockets' },
  { pattern: /\b(microservices?)\b/i, canonical: 'Microservices' }
];

export class RepositorySkillExtractor {
  /**
   * Deterministically extracts and categorizes technical skills from GitHub repository metadata,
   * language statistics, topics, and documentation text.
   */
  extractRepositorySkills(
    repo: Partial<GitHubRepoDTO> & { topics?: string[] },
    readmeText?: string | null,
    additionalLanguages: string[] = []
  ): ExtractedRepoSkills {
    const primarySkillsSet = new Set<string>();
    const secondarySkillsSet = new Set<string>();

    // 1. Primary Repository Language
    if (repo.language && repo.language.trim()) {
      const canonicalLang = normalizeSkillName(repo.language);
      if (canonicalLang) {
        primarySkillsSet.add(canonicalLang);
      }
    }

    // 2. Additional Languages
    for (const lang of additionalLanguages) {
      if (lang && lang.trim()) {
        const canonical = normalizeSkillName(lang);
        if (canonical && !primarySkillsSet.has(canonical)) {
          secondarySkillsSet.add(canonical);
        }
      }
    }

    // 3. Topics / Tags
    const topics = repo.topics || [];
    for (const topic of topics) {
      if (!topic || !topic.trim()) continue;
      const normalized = normalizeSkillName(topic);

      if (ALL_TAXONOMY_SKILLS.has(normalized.toLowerCase())) {
        if (PRIMARY_SKILL_NAMES.has(normalized.toLowerCase())) {
          primarySkillsSet.add(normalized);
        } else {
          secondarySkillsSet.add(normalized);
        }
      }
    }

    // 4. Description & README inspection with bounded deterministic patterns
    const textCorpus = [repo.description || '', readmeText || ''].join(' ');

    if (textCorpus.trim().length > 0) {
      for (const { pattern, canonical } of DETERMINISTIC_TECH_PATTERNS) {
        if (pattern.test(textCorpus)) {
          if (PRIMARY_SKILL_NAMES.has(canonical.toLowerCase())) {
            primarySkillsSet.add(canonical);
          } else {
            secondarySkillsSet.add(canonical);
          }
        }
      }
    }

    // Ensure secondary skills do not duplicate primary skills
    for (const p of primarySkillsSet) {
      secondarySkillsSet.delete(p);
    }

    const primarySkills = Array.from(primarySkillsSet);
    const secondarySkills = Array.from(secondarySkillsSet);
    const allSkills = [...primarySkills, ...secondarySkills];

    return {
      primarySkills,
      secondarySkills,
      allSkills
    };
  }
}

export const repositorySkillExtractor = new RepositorySkillExtractor();
