import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseTableColumns(obj: Record<string, unknown>) {
  const result = { ...obj };
  if (typeof result.tableColumns === "string") {
    try { result.tableColumns = JSON.parse(result.tableColumns as string); } catch { /* keep */ }
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
    const template = await prisma.emailTemplate.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        workstreams: { select: { id: true, name: true } },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(parseTableColumns(template as unknown as Record<string, unknown>));
  } catch (error) {
    console.error("Template GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
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

    const old = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!old) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const allowedFields = [
      "name",
      "subject",
      "body",
      "includeTable",
      "tableColumns",
      "signature",
      "isDefault",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) data[field] = body[field];
    }
    // SQLite: stringify tableColumns on write
    if ("tableColumns" in data && typeof data.tableColumns === "object" && data.tableColumns !== null) {
      data.tableColumns = JSON.stringify(data.tableColumns);
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "update",
        entityType: "EmailTemplate",
        entityId: String(id),
        oldValue: JSON.stringify(old),
        newValue: JSON.stringify(template),
      },
    });

    return NextResponse.json(parseTableColumns(template as unknown as Record<string, unknown>));
  } catch (error) {
    console.error("Template PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
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

    const old = await prisma.emailTemplate.findUnique({
      where: { id },
      include: { workstreams: { select: { id: true, name: true } } },
    });
    if (!old) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (old.workstreams.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: template is used by workstream(s): ${old.workstreams.map((w) => w.name).join(", ")}`,
        },
        { status: 400 }
      );
    }

    await prisma.emailTemplate.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "delete",
        entityType: "EmailTemplate",
        entityId: String(id),
        oldValue: JSON.stringify(old),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Template DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
