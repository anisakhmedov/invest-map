-- CreateEnum
CREATE TYPE "ObjectStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'AUCTION', 'TAKEN');

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "geometry" JSONB NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestObject" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "publish" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "status" "ObjectStatus" NOT NULL DEFAULT 'AVAILABLE',
    "areaHa" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_slug_key" ON "Region"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InvestObject_slug_key" ON "InvestObject"("slug");

-- CreateIndex
CREATE INDEX "InvestObject_regionId_idx" ON "InvestObject"("regionId");

-- CreateIndex
CREATE INDEX "InvestObject_publish_status_category_idx" ON "InvestObject"("publish", "status", "category");

-- AddForeignKey
ALTER TABLE "InvestObject" ADD CONSTRAINT "InvestObject_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
