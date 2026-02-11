import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/batches/[id] — Get batch details with all emails
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchId = parseInt(params.id);
  if (isNaN(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
  }

  const batch = await prisma.sendBatch.findUnique({
    where: { id: batchId },
    include: {
      workstream: { select: { name: true } },
      emails: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: batch.id,
    workstreamId: batch.workstreamId,
    workstreamName: batch.workstream.name,
    triggeredBy: batch.triggeredBy,
    triggerType: batch.triggerType,
    status: batch.status,
    totalCount: batch.totalCount,
    sentCount: batch.sentCount,
    failedCount: batch.failedCount,
    skippedCount: batch.skippedCount,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    emails: batch.emails.map((e) => ({
      id: e.id,
      investmentId: e.investmentId,
      accountName: e.accountName,
      investmentName: e.investmentName,
      investmentStatus: e.investmentStatus,
      toEmail: e.toEmail,
      toName: e.toName,
      ccEmails: e.ccEmails,
      subject: e.subject,
      body: e.body,
      result: e.result,
      errorMessage: e.errorMessage,
      isTest: e.isTest,
      openedAt: e.openedAt,
      openCount: e.openCount,
      sentAt: e.sentAt,
    })),
  });
}
