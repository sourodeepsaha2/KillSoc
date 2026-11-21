-- DropForeignKey
ALTER TABLE "recommendations" DROP CONSTRAINT "recommendations_organizationId_fkey";

-- DropIndex
DROP INDEX "recommendations_organizationId_idx";

-- DropIndex
DROP INDEX "recommendations_userId_organizationId_key";

-- AlterTable
ALTER TABLE "developer_skills" ADD COLUMN     "proficiency" TEXT NOT NULL DEFAULT 'Intermediate',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "details" JSONB,
ADD COLUMN     "isComplete" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "matchedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "missingSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "proficiencyFit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "repoQualityScore" DOUBLE PRECISION,
ADD COLUMN     "repositoryId" UUID NOT NULL,
ADD COLUMN     "skillCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "organizationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "extractedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "developer_skills_proficiency_idx" ON "developer_skills"("proficiency");

-- CreateIndex
CREATE INDEX "recommendations_repositoryId_idx" ON "recommendations"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_userId_repositoryId_key" ON "recommendations"("userId", "repositoryId");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
