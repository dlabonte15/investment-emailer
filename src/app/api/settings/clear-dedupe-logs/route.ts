import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/settings/clear-dedupe-logs — Clear all deduplication logs
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can clear dedupe logs
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { count } = await prisma.dedupeLog.deleteMany({});

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.email,
      action: "dedupe_logs_cleared",
      entityType: "settings",
      newValue: JSON.stringify({ deletedCount: count }),
    },
  });

  return NextResponse.json({ success: true, deletedCount: count });
}
