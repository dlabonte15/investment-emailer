import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// SQLite stores JSON as text — parse on read, stringify on write
function parseJsonFields(ws: Record<string, unknown>) {
  const jsonFields = ["triggerLogic", "recipientConfig", "subTemplateLogic", "tableColumns"];
  const result = { ...ws };
  for (const field of jsonFields) {
    if (typeof result[field] === "string") {
      try { result[field] = JSON.parse(result[field] as string); } catch { /* keep as-is */ }
    }
  }
  return result;
}

function stringifyJsonFields(data: Record<string, unknown>) {
  const jsonFields = ["triggerLogic", "recipientConfig", "subTemplateLogic"];
  const result = { ...data };
  for (const field of jsonFields) {
    if (field in result && typeof result[field] === "object" && result[field] !== null) {
      result[field] = JSON.stringify(result[field]);
    }
  }
  return result;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workstream = await prisma.workstream.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        template: { select: { id: true, name: true } },
      },
    });

    if (!workstream) {
      return NextResponse.json(
        { error: "Workstream not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(parseJsonFields(workstream as unknown as Record<string, unknown>));
  } catch (error) {
    console.error("Workstream GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workstream" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);
    const body = await req.json();

    const old = await prisma.workstream.findUnique({ where: { id } });
    if (!old) {
      return NextResponse.json(
        { error: "Workstream not found" },
        { status: 404 }
      );
    }

    const allowedFields = [
      "name",
      "description",
      "enabled",
      "cadence",
      "cronExpression",
      "triggerLogic",
      "recipientConfig",
      "subTemplateLogic",
      "dedupeWindowDays",
      "escalationThreshold",
      "autoApprove",
      "templateId",
    ] as const;

    const raw: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) raw[field] = body[field];
    }
    const data = stringifyJsonFields(raw);

    const workstream = await prisma.workstream.update({
      where: { id },
      data,
      include: {
        template: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "update",
        entityType: "Workstream",
        entityId: String(id),
        oldValue: JSON.stringify(old),
        newValue: JSON.stringify(workstream),
      },
    });

    return NextResponse.json(parseJsonFields(workstream as unknown as Record<string, unknown>));
  } catch (error) {
    console.error("Workstream PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update workstream" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    const old = await prisma.workstream.findUnique({
      where: { id },
      include: { batches: { select: { id: true }, take: 1 } },
    });
    if (!old) {
      return NextResponse.json(
        { error: "Workstream not found" },
        { status: 404 }
      );
    }

    // Delete related records first
    await prisma.$transaction([
      prisma.dedupeLog.deleteMany({ where: { workstreamId: id } }),
      prisma.escalation.deleteMany({ where: { workstreamId: id } }),
      prisma.workstream.delete({ where: { id } }),
    ]);

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "delete",
        entityType: "Workstream",
        entityId: String(id),
        oldValue: JSON.stringify(old),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Workstream DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete workstream" },
      { status: 500 }
    );
  }
}
