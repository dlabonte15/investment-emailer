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
    let settings = await prisma.globalSettings.findFirst({ where: { id: 1 } });

    if (!settings) {
      settings = await prisma.globalSettings.create({ data: { id: 1 } });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
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

    // Only allow updating known fields
    const allowedFields = [
      "defaultSenderName",
      "defaultSenderEmail",
      "globalCcEmails",
      "sendAsHtml",
      "timezone",
      "dataSourceType",
      "onedriveFileId",
      "excelSheetName",
      "dataFreshnessWarningDays",
      "enableOpenTracking",
      "defaultDedupeWindowDays",
      "defaultEscalationThreshold",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        data[field] = body[field];
      }
    }

    // Fetch old values for audit log
    const oldSettings = await prisma.globalSettings.findFirst({
      where: { id: 1 },
    });

    const settings = await prisma.globalSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "update",
        entityType: "GlobalSettings",
        entityId: "1",
        oldValue: oldSettings ? JSON.stringify(oldSettings) : null,
        newValue: JSON.stringify(settings),
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
