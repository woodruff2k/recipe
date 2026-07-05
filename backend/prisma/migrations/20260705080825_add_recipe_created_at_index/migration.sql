-- DropIndex
DROP INDEX "Recipe_authorId_idx";

-- CreateIndex
CREATE INDEX "Recipe_authorId_createdAt_idx" ON "Recipe"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Recipe_createdAt_idx" ON "Recipe"("createdAt");
