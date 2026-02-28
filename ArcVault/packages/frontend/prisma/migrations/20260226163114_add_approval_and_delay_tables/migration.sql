-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "approverAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelaySchedule" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "resumeAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DelaySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRequest_executionId_nodeId_idx" ON "ApprovalRequest"("executionId", "nodeId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_executionId_nodeId_approverAddress_key" ON "ApprovalRequest"("executionId", "nodeId", "approverAddress");

-- CreateIndex
CREATE INDEX "DelaySchedule_status_idx" ON "DelaySchedule"("status");

-- CreateIndex
CREATE INDEX "DelaySchedule_resumeAt_idx" ON "DelaySchedule"("resumeAt");

-- CreateIndex
CREATE UNIQUE INDEX "DelaySchedule_executionId_nodeId_key" ON "DelaySchedule"("executionId", "nodeId");
