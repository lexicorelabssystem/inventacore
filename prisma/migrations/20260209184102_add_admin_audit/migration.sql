-- CreateEnum
CREATE TYPE "AdminEntityType" AS ENUM ('INSTITUTION', 'ESTABLISHMENT', 'DEPENDENCY');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "AdminAudit" (
    "id" SERIAL NOT NULL,
    "entityType" "AdminEntityType" NOT NULL,
    "action" "AdminActionType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AdminAudit" ADD CONSTRAINT "AdminAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
