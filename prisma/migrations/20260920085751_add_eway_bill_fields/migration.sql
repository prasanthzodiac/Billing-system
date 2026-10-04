-- CreateEnum
CREATE TYPE "EwayBillStatus" AS ENUM ('NOT_GENERATED', 'GENERATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('ROAD', 'RAIL', 'AIR', 'SHIP');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('REGULAR', 'OVER_DIMENSIONAL_CARGO');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "ewayBillCancelReason" TEXT,
ADD COLUMN     "ewayBillCancelledAt" TIMESTAMP(3),
ADD COLUMN     "ewayBillDate" TIMESTAMP(3),
ADD COLUMN     "ewayBillNumber" TEXT,
ADD COLUMN     "ewayBillStatus" "EwayBillStatus" NOT NULL DEFAULT 'NOT_GENERATED',
ADD COLUMN     "ewayBillValidUpto" TIMESTAMP(3),
ADD COLUMN     "transportDistanceKm" INTEGER,
ADD COLUMN     "transportMode" "TransportMode",
ADD COLUMN     "vehicleType" "VehicleType";
