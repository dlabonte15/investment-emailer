import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBatchEmails } from "@/lib/graph-email";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/batches/[id]/approve — Approve a pending batch and send emails
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`batch-approve:${session.user.email}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const batchId = parseInt(params.id);
  if (isNaN(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
  }

  // Parse optional body for excluded email IDs and re-included dedupe overrides
  let excludedEmailIds: number[] = [];
  let reIncludedEmailIds: number[] = [];
  try {
    const body = await req.json();
    excludedEmailIds = body.excludedEmailIds || [];
    reIncludedEmailIds = body.reIncludedEmailIds || [];
  } catch {
    // No body is fine
  }

  const batch = await prisma.sendBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (batch.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Batch is already ${batch.status}` },
      { status: 400 }
    );
  }

  // Re-include manually overridden dedupe emails (skipped_dedupe → pending)
  if (reIncludedEmailIds.length > 0) {
    await prisma.sendEmail.updateMany({
      where: {
        batchId,
        id: { in: reIncludedEmailIds },
        result: "skipped_dedupe",
      },
      data: { result: "pending" },
    });
  }

  // Mark excluded emails as skipped
  if (excludedEmailIds.length > 0) {
    await prisma.sendEmail.updateMany({
      where: {
        batchId,
        id: { in: excludedEmailIds },
        result: "pending",
      },
      data: { result: "skipped" },
    });
  }

  // Update counts
  const skippedCount = await prisma.sendEmail.count({
    where: {
      batchId,
      result: { in: ["skipped", "skipped_dedupe"] },
    },
  });
  const pendingCount = await prisma.sendEmail.count({
    where: { batchId, result: "pending" },
  });
  await prisma.sendBatch.update({
    where: { id: batchId },
    data: { skippedCount, totalCount: pendingCount },
  });

  // Transition to approved
  await prisma.sendBatch.update({
    where: { id: batchId },
    data: { status: "approved" },
  });

  // Log the approval
  await prisma.auditLog.create({
    data: {
      userId: session.user.email,
      action: "batch_approved",
      entityType: "batch",
      entityId: String(batchId),
      newValue: JSON.stringify({
        excludedCount: excludedEmailIds.length,
        reIncludedDedupeCount: reIncludedEmailIds.length,
      }),
    },
  });

  // Send emails asynchronously
  try {
    const result = await sendBatchEmails({
      batchId,
      accessToken: session.accessToken,
    });

    return NextResponse.json({
      success: true,
      batchId,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });
  } catch (error) {
    console.error("Batch send error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send batch";

    // Mark batch as failed
    await prisma.sendBatch.update({
      where: { id: batchId },
      data: { status: "completed", completedAt: new Date() },
    });

    return NextResponse.json(
      { error: message, batchId },
      { status: 500 }
    );
  }
}
