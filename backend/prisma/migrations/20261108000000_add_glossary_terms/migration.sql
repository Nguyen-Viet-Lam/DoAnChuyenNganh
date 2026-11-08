-- CreateEnum
CREATE TYPE "TermCategory" AS ENUM ('CHARACTER', 'LOCATION', 'SKILL', 'ITEM', 'REALM', 'OTHER');

-- CreateTable
CREATE TABLE "glossary_terms" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "originalTerm" TEXT NOT NULL,
    "vietnameseTerm" TEXT NOT NULL,
    "category" "TermCategory" NOT NULL DEFAULT 'CHARACTER',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "glossary_terms_novelId_originalTerm_key" ON "glossary_terms"("novelId", "originalTerm");

-- CreateIndex
CREATE INDEX "glossary_terms_novelId_category_idx" ON "glossary_terms"("novelId", "category");

-- AddForeignKey
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
