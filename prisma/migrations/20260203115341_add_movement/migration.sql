-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('TRANSFER', 'RELOCATION', 'STATUS_CHANGE', 'INVENTORY_CHECK');

-- CreateTable
CREATE TABLE "Movement" (
    "id" SERIAL NOT NULL,
    "type" "MovementType" NOT NULL,
    "assetId" INTEGER NOT NULL,
    "fromDependencyId" INTEGER,
    "toDependencyId" INTEGER,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
