-- AlterEnum
ALTER TYPE "ChapterStatus" ADD VALUE 'PARTIAL';
ALTER TYPE "ChapterStatus" ADD VALUE 'FAILED';

-- CreateEnum
CREATE TYPE "SegmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN "translationStyle" TEXT;

-- CreateTable
CREATE TABLE "chapter_segments" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "translatedText" TEXT,
    "status" "SegmentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT,
    "segmentId" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chapter_segments_chapterId_orderIndex_key" ON "chapter_segments"("chapterId", "orderIndex");

-- CreateIndex
CREATE INDEX "ai_usage_logs_userId_createdAt_idx" ON "ai_usage_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "chapter_segments" ADD CONSTRAINT "chapter_segments_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
