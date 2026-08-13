-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'CLAIMED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAttempt" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_userId_idx" ON "WorkspaceMembership"("userId");

-- CreateIndex
CREATE INDEX "Item_workspaceId_status_createdAt_idx" ON "Item"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Item_claimedById_idx" ON "Item"("claimedById");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAttempt_itemId_key" ON "NotificationAttempt"("itemId");

-- CreateIndex
CREATE INDEX "NotificationAttempt_status_idx" ON "NotificationAttempt"("status");

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariants Prisma cannot express in schema.prisma.
--
-- These keep item state internally consistent no matter which code path writes
-- the row. Application logic can be wrong; these cannot be bypassed.
-- ---------------------------------------------------------------------------

-- An item's status must agree with its claim and resolution columns.
--
--   PENDING  -> nobody holds it, nothing resolved
--   CLAIMED  -> a claimant and a claim time, not yet resolved
--   RESOLVED -> resolved time set, and the claimant who resolved it retained
--
-- Retaining the claimant on RESOLVED is deliberate: it records who did the
-- work. It also means a resolve can only ever follow a claim.
ALTER TABLE "Item" ADD CONSTRAINT "Item_status_fields_consistent" CHECK (
  (
    "status" = 'PENDING'
    AND "claimedById" IS NULL
    AND "claimedAt" IS NULL
    AND "resolvedAt" IS NULL
  )
  OR (
    "status" = 'CLAIMED'
    AND "claimedById" IS NOT NULL
    AND "claimedAt" IS NOT NULL
    AND "resolvedAt" IS NULL
  )
  OR (
    "status" = 'RESOLVED'
    AND "claimedById" IS NOT NULL
    AND "claimedAt" IS NOT NULL
    AND "resolvedAt" IS NOT NULL
  )
);

-- A finished notification attempt must record when it finished, and an
-- unfinished one must not pretend it has.
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_finished_consistent" CHECK (
  ("status" = 'PENDING' AND "finishedAt" IS NULL)
  OR ("status" IN ('SENT', 'FAILED') AND "finishedAt" IS NOT NULL)
);

-- A failed attempt must say why. A successful one must not carry an error.
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_error_consistent" CHECK (
  ("status" = 'FAILED' AND "error" IS NOT NULL)
  OR ("status" <> 'FAILED' AND "error" IS NULL)
);
