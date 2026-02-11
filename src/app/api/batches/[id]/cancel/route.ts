import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/batches/[id]/cancel — Cancel a pending batch
export async function POST(
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
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (batch.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot cancel a batch with status: ${batch.status}` },
      { status: 400 }
    );
  }

  // Mark all pending emails as skipped
  await prisma.sendEmail.updateMany({
    where: { batchId, result: "pending" },
    data: { result: "skipped" },
  });

  // Update batch
  const skippedCount = await prisma.sendEmail.count({
    where: { batchId, result: "skipped" },
  });

  await prisma.sendBatch.update({
    where: { id: batchId },
    data: {
      status: "completed",
      completedAt: new Date(),
      skippedCount,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.email,
      action: "batch_cancelled",
      entityType: "batch",
      entityId: String(batchId),
    },
  });

  return NextResponse.json({ success: true, batchId });
}
