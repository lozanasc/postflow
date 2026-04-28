-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "maxClips" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "templateConfig" JSONB,
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "ClipTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClipTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClipTemplate" ADD CONSTRAINT "ClipTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
