-- CreateTable
CREATE TABLE "ShopUsage" (
    "shop" TEXT NOT NULL,
    "configuredProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopUsage_pkey" PRIMARY KEY ("shop")
);
