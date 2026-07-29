-- AlterTable
ALTER TABLE "Dependency" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
