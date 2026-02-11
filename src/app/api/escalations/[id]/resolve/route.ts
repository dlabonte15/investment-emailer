import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/escalations/[id]/resolve — Mark escalation as resolved
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const escalationId = parseInt(params.id);
    const body = await req.json().catch(() => ({}));

    const escalation = await prisma.escalation.findUnique({
      where: { id: escalationId },
    });

    if (!escalation) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.escalation.update({
      where: { id: escalationId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: session.user.email,
        notes: body.notes || escalation.notes,
      },
      include: {
        workstream: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "escalation_resolved",
        entityType: "Escalation",
        entityId: String(escalationId),
        oldValue: JSON.stringify({ resolved: false }),
        newValue: JSON.stringify({
          resolved: true,
          resolvedBy: session.user.email,
          notes: body.notes,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Escalation resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve escalation" },
      { status: 500 }
    );
  }
}
