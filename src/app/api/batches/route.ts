import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/batches — List all batches with pagination and filters
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const workstreamId = searchParams.get("workstreamId");
  const triggerType = searchParams.get("triggerType");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (workstreamId) where.workstreamId = parseInt(workstreamId);
  if (triggerType) where.triggerType = triggerType;
  if (search) {
    where.emails = {
      some: {
        OR: [
          { accountName: { contains: search, mode: "insensitive" } },
          { toEmail: { contains: search, mode: "insensitive" } },
          { investmentId: { contains: search, mode: "insensitive" } },
        ],
      },
    };
  }

  const [batches, total] = await Promise.all([
    prisma.sendBatch.findMany({
      where,
      include: {
        workstream: { select: { name: true } },
        _count: { select: { emails: true } },
      },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sendBatch.count({ where }),
  ]);

  return NextResponse.json({
    batches: batches.map((b) => ({
      id: b.id,
      workstreamId: b.workstreamId,
      workstreamName: b.workstream.name,
      triggeredBy: b.triggeredBy,
      triggerType: b.triggerType,
      status: b.status,
      totalCount: b.totalCount,
      sentCount: b.sentCount,
      failedCount: b.failedCount,
      skippedCount: b.skippedCount,
      emailCount: b._count.emails,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
