-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "InvestObject" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "publish" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "startPriceUsd" DOUBLE PRECISION NOT NULL,
    "terms" JSONB NOT NULL,
    "finalPriceUsd" DOUBLE PRECISION,
    "resultNote" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ObjectDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ObjectDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Auction_objectId_idx" ON "Auction"("objectId");

-- CreateIndex
CREATE INDEX "Auction_publish_status_startsAt_idx" ON "Auction"("publish", "status", "startsAt");

-- CreateIndex
CREATE INDEX "_ObjectDocuments_B_index" ON "_ObjectDocuments"("B");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "InvestObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObjectDocuments" ADD CONSTRAINT "_ObjectDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "InvestObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObjectDocuments" ADD CONSTRAINT "_ObjectDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
