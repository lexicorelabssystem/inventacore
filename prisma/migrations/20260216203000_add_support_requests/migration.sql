-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "SupportRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "responseDraft" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdById" INTEGER NOT NULL,
    "assignedToId" INTEGER,
    "institutionId" INTEGER,
    "establishmentId" INTEGER,
    "dependencyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequestComment" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");

-- CreateIndex
CREATE INDEX "SupportRequest_priority_idx" ON "SupportRequest"("priority");

-- CreateIndex
CREATE INDEX "SupportRequest_dueAt_idx" ON "SupportRequest"("dueAt");

-- CreateIndex
CREATE INDEX "SupportRequest_createdAt_idx" ON "SupportRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_institutionId_idx" ON "SupportRequest"("institutionId");

-- CreateIndex
CREATE INDEX "SupportRequest_establishmentId_idx" ON "SupportRequest"("establishmentId");

-- CreateIndex
CREATE INDEX "SupportRequest_dependencyId_idx" ON "SupportRequest"("dependencyId");

-- CreateIndex
CREATE INDEX "SupportRequestComment_requestId_idx" ON "SupportRequestComment"("requestId");

-- CreateIndex
CREATE INDEX "SupportRequestComment_authorId_idx" ON "SupportRequestComment"("authorId");

-- CreateIndex
CREATE INDEX "SupportRequestComment_createdAt_idx" ON "SupportRequestComment"("createdAt");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "Dependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestComment" ADD CONSTRAINT "SupportRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestComment" ADD CONSTRAINT "SupportRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
