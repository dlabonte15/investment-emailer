import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/escalations — List escalated investments
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const resolved = searchParams.get("resolved");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (resolved === "true") where.resolved = true;
  else if (resolved === "false") where.resolved = false;

  try {
    const [escalations, total] = await Promise.all([
      prisma.escalation.findMany({
        where,
        include: {
          workstream: { select: { name: true } },
        },
        orderBy: { lastEmailedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.escalation.count({ where }),
    ]);

    return NextResponse.json({
      escalations: escalations.map((e) => ({
        id: e.id,
        workstreamId: e.workstreamId,
        workstreamName: e.workstream.name,
        investmentId: e.investmentId,
        accountName: e.accountName,
        investmentName: e.investmentName,
        currentStatus: e.currentStatus,
        sendCount: e.sendCount,
        firstEmailedAt: e.firstEmailedAt,
        lastEmailedAt: e.lastEmailedAt,
        resolved: e.resolved,
        resolvedAt: e.resolvedAt,
        resolvedBy: e.resolvedBy,
        notes: e.notes,
        createdAt: e.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Escalations GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch escalations" },
      { status: 500 }
    );
  }
}
