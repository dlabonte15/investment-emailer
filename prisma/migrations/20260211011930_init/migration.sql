-- CreateTable
CREATE TABLE "Workstream" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cadence" TEXT NOT NULL,
    "cronExpression" TEXT,
    "triggerLogic" TEXT NOT NULL,
    "recipientConfig" TEXT NOT NULL,
    "subTemplateLogic" TEXT,
    "dedupeWindowDays" INTEGER NOT NULL DEFAULT 7,
    "escalationThreshold" INTEGER NOT NULL DEFAULT 3,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "templateId" INTEGER NOT NULL,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workstream_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "includeTable" BOOLEAN NOT NULL DEFAULT false,
    "tableColumns" TEXT,
    "signature" TEXT NOT NULL DEFAULT 'Account Investment Concierge',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IndustryContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "primaryIndustry" TEXT NOT NULL,
    "selName" TEXT NOT NULL,
    "selEmail" TEXT NOT NULL,
    "opsManagerName" TEXT NOT NULL,
    "opsManagerEmail" TEXT NOT NULL,
    "conciergeName" TEXT NOT NULL DEFAULT 'US Consulting Account Investment Concierge',
    "conciergeEmail" TEXT NOT NULL DEFAULT 'accountinvestmentcommittee@deloitte.com',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SendBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workstreamId" INTEGER NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "SendBatch_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SendEmail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "investmentId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "investmentName" TEXT NOT NULL,
    "investmentStatus" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "ccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorMessage" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" DATETIME,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SendEmail_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SendBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DedupeLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workstreamId" INTEGER NOT NULL,
    "investmentId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DedupeLog_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workstreamId" INTEGER NOT NULL,
    "investmentId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "investmentName" TEXT NOT NULL,
    "currentStatus" TEXT NOT NULL,
    "sendCount" INTEGER NOT NULL,
    "firstEmailedAt" DATETIME NOT NULL,
    "lastEmailedAt" DATETIME NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Escalation_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "defaultSenderName" TEXT NOT NULL DEFAULT 'Account Investment Concierge',
    "defaultSenderEmail" TEXT NOT NULL DEFAULT '',
    "globalCcEmails" TEXT NOT NULL DEFAULT '',
    "sendAsHtml" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "dataSourceType" TEXT NOT NULL DEFAULT 'upload',
    "onedriveFileId" TEXT,
    "excelSheetName" TEXT NOT NULL DEFAULT 'FY26  Account Investments_  (2)',
    "dataFreshnessWarningDays" INTEGER NOT NULL DEFAULT 7,
    "enableOpenTracking" BOOLEAN NOT NULL DEFAULT false,
    "defaultDedupeWindowDays" INTEGER NOT NULL DEFAULT 7,
    "defaultEscalationThreshold" INTEGER NOT NULL DEFAULT 3
);

-- CreateTable
CREATE TABLE "ColumnMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "internalField" TEXT NOT NULL,
    "excelColumn" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DataLoadLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceType" TEXT NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "loadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loadedBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sender',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InvestmentNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "investmentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Workstream_name_key" ON "Workstream"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_name_key" ON "EmailTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryContact_primaryIndustry_key" ON "IndustryContact"("primaryIndustry");

-- CreateIndex
CREATE UNIQUE INDEX "DedupeLog_workstreamId_investmentId_recipientEmail_key" ON "DedupeLog"("workstreamId", "investmentId", "recipientEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Escalation_workstreamId_investmentId_key" ON "Escalation"("workstreamId", "investmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnMapping_internalField_key" ON "ColumnMapping"("internalField");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
