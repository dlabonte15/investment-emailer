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
    const contacts = await prisma.industryContact.findMany({
      orderBy: { primaryIndustry: "asc" },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Contacts GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
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
      primaryIndustry,
      selName,
      selEmail,
      opsManagerName,
      opsManagerEmail,
      conciergeName,
      conciergeEmail,
    } = body;

    if (!primaryIndustry || !selName || !selEmail || !opsManagerName || !opsManagerEmail) {
      return NextResponse.json(
        { error: "Primary Industry, SEL, and Ops Manager fields are required" },
        { status: 400 }
      );
    }

    const contact = await prisma.industryContact.create({
      data: {
        primaryIndustry,
        selName,
        selEmail,
        opsManagerName,
        opsManagerEmail,
        conciergeName: conciergeName || "US Consulting Account Investment Concierge",
        conciergeEmail: conciergeEmail || "accountinvestmentcommittee@deloitte.com",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "create",
        entityType: "IndustryContact",
        entityId: String(contact.id),
        newValue: JSON.stringify(contact),
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error: unknown) {
    console.error("Contacts POST error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A mapping for this industry already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
