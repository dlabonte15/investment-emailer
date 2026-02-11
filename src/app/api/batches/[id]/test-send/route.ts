import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBatchEmails } from "@/lib/graph-email";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/batches/[id]/test-send — Send batch in test mode (all emails to self)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`batch-test:${session.user.email}`, 5, 60_000);
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

  const batch = await prisma.sendBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (batch.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot test-send a batch with status: ${batch.status}` },
      { status: 400 }
    );
  }

  // For test sends, mark batch as test type and approved
  await prisma.sendBatch.update({
    where: { id: batchId },
    data: {
      status: "approved",
      triggerType: "test",
    },
  });

  try {
    const result = await sendBatchEmails({
      batchId,
      accessToken: session.accessToken,
      testMode: true,
      testEmail: session.user.email,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "batch_test_send",
        entityType: "batch",
        entityId: String(batchId),
        newValue: JSON.stringify({
          testEmail: session.user.email,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      batchId,
      testEmail: session.user.email,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });
  } catch (error) {
    console.error("Test send error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to test send";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
