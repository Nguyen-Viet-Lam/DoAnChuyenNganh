CREATE TYPE "QaIssueType" AS ENUM ('EMPTY_TRANSLATION', 'TOO_SHORT', 'GLOSSARY_MISMATCH');
CREATE TYPE "QaSeverity" AS ENUM ('ERROR', 'WARNING');

CREATE TABLE "translation_qa_issues" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "glossaryTermId" TEXT,
    "type" "QaIssueType" NOT NULL,
    "severity" "QaSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "ignoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "translation_qa_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "translation_qa_issues_segmentId_fingerprint_key"
ON "translation_qa_issues"("segmentId", "fingerprint");

CREATE INDEX "translation_qa_issues_chapterId_ignored_severity_idx"
ON "translation_qa_issues"("chapterId", "ignored", "severity");

ALTER TABLE "translation_qa_issues"
ADD CONSTRAINT "translation_qa_issues_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "translation_qa_issues"
ADD CONSTRAINT "translation_qa_issues_segmentId_fkey"
FOREIGN KEY ("segmentId") REFERENCES "chapter_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "translation_qa_issues"
ADD CONSTRAINT "translation_qa_issues_glossaryTermId_fkey"
FOREIGN KEY ("glossaryTermId") REFERENCES "glossary_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
