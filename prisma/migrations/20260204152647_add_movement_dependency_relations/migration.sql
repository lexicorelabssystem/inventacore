-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_fromDependencyId_fkey" FOREIGN KEY ("fromDependencyId") REFERENCES "Dependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_toDependencyId_fkey" FOREIGN KEY ("toDependencyId") REFERENCES "Dependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
