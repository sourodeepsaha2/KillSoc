import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Clean datasource URL for migrations (remove pooler and channel_binding for Prisma schema-engine compatibility)
const formatDatasourceUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  return url
    .replace('-pooler', '')
    .replace('&channel_binding=require', '')
    .replace('channel_binding=require&', '');
};

const datasourceUrl =
  process.env['DIRECT_URL'] || formatDatasourceUrl(process.env['DATABASE_URL']);

const shadowDatabaseUrl =
  process.env['SHADOW_DATABASE_URL'] ||
  'postgresql://postgres:postgres@localhost:5432/killsoc_shadow';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: datasourceUrl,
    shadowDatabaseUrl: shadowDatabaseUrl
  }
});
