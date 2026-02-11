import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseJsonFields(obj: Record<string, unknown>) {
  const jsonFields = ["triggerLogic", "recipientConfig", "subTemplateLogic", "tableColumns"];
  const result = { ...obj };
  for (const f of jsonFields) {
    if (typeof result[f] === "string") {
      try { result[f] = JSON.parse(result[f] as string); } catch { /* keep */ }
    }
  }
  return result;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workstreams = await prisma.workstream.findMany({
      include: {
        template: { select: { id: true, name: true } },
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });

    return NextResponse.json(
      workstreams.map((ws) => parseJsonFields(ws as unknown as Record<string, unknown>))
    );
  } catch (error) {
    console.error("Workstreams GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workstreams" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name,
      description,
      enabled,
      cadence,
      cronExpression,
      triggerLogic,
      recipientConfig,
      subTemplateLogic,
      dedupeWindowDays,
      escalationThreshold,
      autoApprove,
      templateId,
    } = body;

    if (!name || !templateId) {
      return NextResponse.json(
        { error: "Name and template are required" },
        { status: 400 }
      );
    }

    // SQLite: stringify JSON fields before writing
    const triggerLogicStr = typeof triggerLogic === "object"
      ? JSON.stringify(triggerLogic || { conditions: [], logic: "AND" })
      : triggerLogic || JSON.stringify({ conditions: [], logic: "AND" });
    const recipientConfigStr = typeof recipientConfig === "object"
      ? JSON.stringify(recipientConfig || { to: [], cc: [] })
      : recipientConfig || JSON.stringify({ to: [], cc: [] });
    const subTemplateLogicStr = subTemplateLogic
      ? (typeof subTemplateLogic === "object" ? JSON.stringify(subTemplateLogic) : subTemplateLogic)
      : null;

    const workstream = await prisma.workstream.create({
      data: {
        name,
        description: description || null,
        enabled: enabled ?? true,
        cadence: cadence || "manual",
        cronExpression: cronExpression || null,
        triggerLogic: triggerLogicStr,
        recipientConfig: recipientConfigStr,
        subTemplateLogic: subTemplateLogicStr,
        dedupeWindowDays: dedupeWindowDays ?? 7,
        escalationThreshold: escalationThreshold ?? 3,
        autoApprove: autoApprove ?? false,
        templateId,
      },
      include: {
        template: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "create",
        entityType: "Workstream",
        entityId: String(workstream.id),
        newValue: JSON.stringify(workstream),
      },
    });

    return NextResponse.json(
      parseJsonFields(workstream as unknown as Record<string, unknown>),
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Workstreams POST error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A workstream with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create workstream" },
      { status: 500 }
    );
  }
}
