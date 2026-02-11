import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const mappings = await prisma.columnMapping.findMany({
      orderBy: { internalField: "asc" },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Column mappings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch column mappings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const mappings: { id?: number; internalField: string; excelColumn: string }[] =
      body.mappings;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "Invalid payload: expected { mappings: [...] }" },
        { status: 400 }
      );
    }

    // Fetch old mappings for audit log
    const oldMappings = await prisma.columnMapping.findMany({
      orderBy: { internalField: "asc" },
    });

    // Use a transaction to replace all mappings
    const result = await prisma.$transaction(async (tx) => {
      // Update existing mappings and create new ones
      const upserted = [];
      for (const mapping of mappings) {
        const record = await tx.columnMapping.upsert({
          where: { internalField: mapping.internalField },
          update: { excelColumn: mapping.excelColumn },
          create: {
            internalField: mapping.internalField,
            excelColumn: mapping.excelColumn,
          },
        });
        upserted.push(record);
      }

      // Delete mappings that are no longer in the list
      const activeFields = new Set(mappings.map((m) => m.internalField));
      const toDelete = oldMappings.filter(
        (m) => !activeFields.has(m.internalField)
      );
      if (toDelete.length > 0) {
        await tx.columnMapping.deleteMany({
          where: { id: { in: toDelete.map((m) => m.id) } },
        });
      }

      return upserted;
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "update",
        entityType: "ColumnMapping",
        oldValue: JSON.stringify(oldMappings),
        newValue: JSON.stringify(result),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Column mappings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update column mappings" },
      { status: 500 }
    );
  }
}
