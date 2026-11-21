-- CreateTable
CREATE TABLE "repository_analyses" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "activityScore" DOUBLE PRECISION NOT NULL,
    "communityScore" DOUBLE PRECISION NOT NULL,
    "documentationScore" DOUBLE PRECISION NOT NULL,
    "beginnerScore" DOUBLE PRECISION NOT NULL,
    "maintenanceScore" DOUBLE PRECISION NOT NULL,
    "explanations" JSONB NOT NULL,
    "metricsSummary" JSONB NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT true,
    "lastAnalyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repository_analyses_repositoryId_key" ON "repository_analyses"("repositoryId");

-- CreateIndex
CREATE INDEX "repository_analyses_overallScore_idx" ON "repository_analyses"("overallScore");

-- CreateIndex
CREATE INDEX "repository_analyses_beginnerScore_idx" ON "repository_analyses"("beginnerScore");

-- CreateIndex
CREATE INDEX "repository_analyses_lastAnalyzedAt_idx" ON "repository_analyses"("lastAnalyzedAt");

-- AddForeignKey
ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
