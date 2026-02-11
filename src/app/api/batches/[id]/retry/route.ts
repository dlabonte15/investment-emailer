import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retryFailedEmails } from "@/lib/graph-email";

// POST /api/batches/[id]/retry — Retry failed emails in a batch
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchId = parseInt(params.id);
  if (isNaN(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
  }

  const batch = await prisma.sendBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (batch.failedCount === 0) {
    return NextResponse.json(
      { error: "No failed emails to retry" },
      { status: 400 }
    );
  }

  try {
    const result = await retryFailedEmails(batchId, session.accessToken);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "batch_retry",
        entityType: "batch",
        entityId: String(batchId),
        newValue: JSON.stringify({
          sentCount: result.sentCount,
          failedCount: result.failedCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      batchId,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });
  } catch (error) {
    console.error("Batch retry error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retry batch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
