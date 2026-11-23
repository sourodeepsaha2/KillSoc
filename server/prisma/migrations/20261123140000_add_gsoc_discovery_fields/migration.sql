-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "assignee" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "commentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBeginnerFriendly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matchingLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "number" INTEGER;

-- AlterTable
ALTER TABLE "organization_years" ADD COLUMN     "ideasUrl" TEXT,
ADD COLUMN     "projectsUrl" TEXT,
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "category" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'DEVELOPER';

-- CreateIndex
CREATE INDEX "issues_isBeginnerFriendly_idx" ON "issues"("isBeginnerFriendly");

-- CreateIndex
CREATE INDEX "issues_number_idx" ON "issues"("number");

-- CreateIndex
CREATE INDEX "organizations_name_idx" ON "organizations"("name");

-- CreateIndex
CREATE INDEX "organizations_category_idx" ON "organizations"("category");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
