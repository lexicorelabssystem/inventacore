-- CreateTable
CREATE TABLE "LoginAudit" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userId" INTEGER,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAudit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LoginAudit" ADD CONSTRAINT "LoginAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
