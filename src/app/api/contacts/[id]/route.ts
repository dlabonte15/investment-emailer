import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const old = await prisma.industryContact.findUnique({ where: { id } });
    if (!old) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const allowedFields = [
      "primaryIndustry",
      "selName",
      "selEmail",
      "opsManagerName",
      "opsManagerEmail",
      "conciergeName",
      "conciergeEmail",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) data[field] = body[field];
    }

    const contact = await prisma.industryContact.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "update",
        entityType: "IndustryContact",
        entityId: String(id),
        oldValue: JSON.stringify(old),
        newValue: JSON.stringify(contact),
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Contact PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
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

    const old = await prisma.industryContact.findUnique({ where: { id } });
    if (!old) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await prisma.industryContact.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "delete",
        entityType: "IndustryContact",
        entityId: String(id),
        oldValue: JSON.stringify(old),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
