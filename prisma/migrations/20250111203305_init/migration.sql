-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "tenant" UUID NOT NULL,
    "sender" UUID NOT NULL,
    "recipient" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
