# ============================================================================
# Stage 1: Build Stage
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl libc6-compat

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code and build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ============================================================================
# Stage 2: Production Runner
# ============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=5001

# Copy dependency definitions and install production packages only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Also install prisma globally or as CLI for running `prisma migrate deploy`
RUN npm install -g prisma@7.10.1

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
USER node

EXPOSE 5001

CMD ["node", "dist/server.js"]
