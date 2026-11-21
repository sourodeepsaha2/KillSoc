import type { ProficiencyLevel } from '../../types/index.js';

export interface SkillTaxonomyCategory {
  category: string;
  skills: string[];
}

export const SKILL_TAXONOMY: SkillTaxonomyCategory[] = [
  {
    category: 'Programming Languages',
    skills: [
      'JavaScript',
      'TypeScript',
      'Python',
      'Java',
      'C++',
      'C',
      'C#',
      'Go',
      'Rust',
      'Ruby',
      'PHP',
      'Swift',
      'Kotlin',
      'Dart',
      'Scala',
      'R',
      'Shell',
      'SQL',
      'HTML',
      'CSS'
    ]
  },
  {
    category: 'Web & App Frameworks',
    skills: [
      'React',
      'Next.js',
      'Vue.js',
      'Angular',
      'Node.js',
      'Express',
      'NestJS',
      'Django',
      'FastAPI',
      'Flask',
      'Spring Boot',
      'Ruby on Rails',
      'ASP.NET',
      'Flutter',
      'React Native',
      'Svelte'
    ]
  },
  {
    category: 'Databases & Storage',
    skills: [
      'PostgreSQL',
      'MongoDB',
      'Redis',
      'MySQL',
      'SQLite',
      'Cassandra',
      'DynamoDB',
      'Elasticsearch',
      'Neo4j',
      'Firebase'
    ]
  },
  {
    category: 'DevOps & Cloud',
    skills: [
      'Docker',
      'Kubernetes',
      'AWS',
      'Google Cloud',
      'Azure',
      'Terraform',
      'CI/CD',
      'GitHub Actions',
      'Linux',
      'Nginx'
    ]
  },
  {
    category: 'AI & Data Science',
    skills: [
      'Machine Learning',
      'Deep Learning',
      'NLP',
      'Computer Vision',
      'PyTorch',
      'TensorFlow',
      'Data Science',
      'Pandas',
      'NumPy'
    ]
  },
  {
    category: 'Core Concepts & Systems',
    skills: [
      'Data Structures and Algorithms',
      'System Design',
      'GraphQL',
      'REST APIs',
      'WebSockets',
      'Microservices',
      'Security',
      'Cryptography'
    ]
  }
];

// Alias mapping for case-insensitive normalization
const SKILL_ALIASES: Record<string, string> = {
  // Languages
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  python3: 'Python',
  java: 'Java',
  cpp: 'C++',
  'c++': 'C++',
  cplusplus: 'C++',
  c: 'C',
  'c#': 'C#',
  csharp: 'C#',
  go: 'Go',
  golang: 'Go',
  rust: 'Rust',
  'rust-lang': 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
  scala: 'Scala',
  r: 'R',
  shell: 'Shell',
  bash: 'Shell',
  sh: 'Shell',
  zsh: 'Shell',
  sql: 'SQL',
  html: 'HTML',
  html5: 'HTML',
  css: 'CSS',
  css3: 'CSS',

  // Frameworks
  react: 'React',
  reactjs: 'React',
  'react.js': 'React',
  next: 'Next.js',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  vue: 'Vue.js',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  angular: 'Angular',
  angularjs: 'Angular',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  express: 'Express',
  expressjs: 'Express',
  'express.js': 'Express',
  nest: 'NestJS',
  nestjs: 'NestJS',
  django: 'Django',
  fastapi: 'FastAPI',
  flask: 'Flask',
  spring: 'Spring Boot',
  springboot: 'Spring Boot',
  'spring-boot': 'Spring Boot',
  rails: 'Ruby on Rails',
  'ruby on rails': 'Ruby on Rails',
  aspnet: 'ASP.NET',
  'asp.net': 'ASP.NET',
  flutter: 'Flutter',
  reactnative: 'React Native',
  'react-native': 'React Native',
  svelte: 'Svelte',

  // Databases
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  redis: 'Redis',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  sqlite3: 'SQLite',
  cassandra: 'Cassandra',
  dynamo: 'DynamoDB',
  dynamodb: 'DynamoDB',
  elastic: 'Elasticsearch',
  elasticsearch: 'Elasticsearch',
  neo4j: 'Neo4j',
  firebase: 'Firebase',

  // DevOps & Cloud
  docker: 'Docker',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  aws: 'AWS',
  gcp: 'Google Cloud',
  'google cloud': 'Google Cloud',
  azure: 'Azure',
  terraform: 'Terraform',
  cicd: 'CI/CD',
  'ci/cd': 'CI/CD',
  actions: 'GitHub Actions',
  'github actions': 'GitHub Actions',
  'github-actions': 'GitHub Actions',
  linux: 'Linux',
  nginx: 'Nginx',

  // AI & Data
  ml: 'Machine Learning',
  'machine learning': 'Machine Learning',
  dl: 'Deep Learning',
  'deep learning': 'Deep Learning',
  nlp: 'NLP',
  'natural language processing': 'NLP',
  cv: 'Computer Vision',
  'computer vision': 'Computer Vision',
  pytorch: 'PyTorch',
  torch: 'PyTorch',
  tensorflow: 'TensorFlow',
  tf: 'TensorFlow',
  'data science': 'Data Science',
  pandas: 'Pandas',
  numpy: 'NumPy',

  // Concepts
  dsa: 'Data Structures and Algorithms',
  'data structures': 'Data Structures and Algorithms',
  algorithms: 'Data Structures and Algorithms',
  'data structures and algorithms': 'Data Structures and Algorithms',
  'system design': 'System Design',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  rest: 'REST APIs',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  restful: 'REST APIs',
  websocket: 'WebSockets',
  websockets: 'WebSockets',
  microservices: 'Microservices',
  security: 'Security',
  cryptography: 'Cryptography',
  crypto: 'Cryptography'
};

/**
 * Normalizes any skill string to its canonical taxonomy form.
 * Trims whitespace, cleans punctuation, resolves synonyms, and Title Cases custom entries.
 */
export function normalizeSkillName(input: string): string {
  if (!input || typeof input !== 'string') return '';

  const clean = input.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();

  // 1. Check exact alias map
  if (SKILL_ALIASES[lower]) {
    return SKILL_ALIASES[lower];
  }

  // 2. Check without trailing punctuation or dashes
  const stripped = lower.replace(/[-_.]/g, '');
  if (SKILL_ALIASES[stripped]) {
    return SKILL_ALIASES[stripped];
  }

  // 3. Fallback: Capitalize each word properly for non-aliased valid terms
  return clean
    .split(' ')
    .map(word => {
      if (word.length <= 2) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export const VALID_PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  'Beginner',
  'Intermediate',
  'Advanced'
];

/**
 * Validates whether a value is a valid ProficiencyLevel.
 */
export function isValidProficiency(level: string): level is ProficiencyLevel {
  return VALID_PROFICIENCY_LEVELS.some(
    p => p.toLowerCase() === (level || '').trim().toLowerCase()
  );
}

/**
 * Normalizes input to canonical 'Beginner' | 'Intermediate' | 'Advanced' (defaults to 'Intermediate').
 */
export function normalizeProficiency(level?: string): ProficiencyLevel {
  if (!level) return 'Intermediate';
  const lower = level.trim().toLowerCase();
  if (lower === 'beginner') return 'Beginner';
  if (lower === 'advanced') return 'Advanced';
  return 'Intermediate';
}
