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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await prisma.emailTemplate.findMany({
      include: {
        workstreams: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      templates.map((t) => parseTableColumns(t as unknown as Record<string, unknown>))
    );
  } catch (error) {
    console.error("Templates GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
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
    const { name, subject, body: templateBody, includeTable, tableColumns, signature } = body;

    if (!name || !subject) {
      return NextResponse.json(
        { error: "Name and subject are required" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        body: templateBody || "",
        includeTable: includeTable || false,
        tableColumns: tableColumns
          ? (typeof tableColumns === "object" ? JSON.stringify(tableColumns) : tableColumns)
          : null,
        signature: signature || "Account Investment Concierge",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "create",
        entityType: "EmailTemplate",
        entityId: String(template.id),
        newValue: JSON.stringify(template),
      },
    });

    return NextResponse.json(
      parseTableColumns(template as unknown as Record<string, unknown>),
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Templates POST error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
