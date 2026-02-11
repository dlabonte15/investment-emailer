import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = parseInt(params.id);

    const original = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!original) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Find a unique name
    let copyName = `${original.name} (Copy)`;
    let counter = 2;
    while (await prisma.emailTemplate.findUnique({ where: { name: copyName } })) {
      copyName = `${original.name} (Copy ${counter})`;
      counter++;
    }

    const duplicate = await prisma.emailTemplate.create({
      data: {
        name: copyName,
        subject: original.subject,
        body: original.body,
        includeTable: original.includeTable,
        tableColumns: original.tableColumns || null,
        signature: original.signature,
        isDefault: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "duplicate",
        entityType: "EmailTemplate",
        entityId: String(duplicate.id),
        oldValue: JSON.stringify({ sourceId: id, sourceName: original.name }),
        newValue: JSON.stringify(duplicate),
      },
    });

    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    console.error("Template duplicate error:", error);
    return NextResponse.json(
      { error: "Failed to duplicate template" },
      { status: 500 }
    );
  }
}
