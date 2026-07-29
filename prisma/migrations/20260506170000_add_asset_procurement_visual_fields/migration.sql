-- AlterTable
ALTER TABLE "Asset"
ADD COLUMN "color" TEXT,
ADD COLUMN "medidas" TEXT,
ADD COLUMN "caracteristicas" TEXT,
ADD COLUMN "proveedorRut" TEXT,
ADD COLUMN "proveedorNombre" TEXT,
ADD COLUMN "ordenCompra" TEXT,
ADD COLUMN "ocFecha" TIMESTAMP(3),
ADD COLUMN "factura" TEXT,
ADD COLUMN "facturaFecha" TIMESTAMP(3),
ADD COLUMN "guia" TEXT,
ADD COLUMN "guiaFecha" TIMESTAMP(3),
ADD COLUMN "folioDevengo" TEXT;
