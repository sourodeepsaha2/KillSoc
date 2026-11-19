import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prefer DIRECT_URL for migrations (e.g. Neon unpooled connection) if provided, otherwise DATABASE_URL
const datasourceUrl =
  process.env['DIRECT_URL'] ||
  (process.env['DATABASE_URL'] ? process.env['DATABASE_URL'].replace('-pooler', '') : undefined);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: datasourceUrl
  }
});
