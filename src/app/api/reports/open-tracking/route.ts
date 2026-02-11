import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.globalSettings.findFirst({
      where: { id: 1 },
    });

    if (!settings?.enableOpenTracking) {
      return NextResponse.json({
        enabled: false,
        message: "Open tracking is disabled. Enable it in Settings.",
      });
    }

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    // Overall open stats
    const [totalSent, totalOpened] = await Promise.all([
      prisma.sendEmail.count({
        where: { result: "sent", isTest: false },
      }),
      prisma.sendEmail.count({
        where: {
          result: "sent",
          isTest: false,
          openedAt: { not: null },
        },
      }),
    ]);

    // Open rate by workstream
    const workstreams = await prisma.workstream.findMany({
      select: { id: true, name: true },
    });

    const byWorkstream = await Promise.all(
      workstreams.map(async (ws) => {
        const [sent, opened] = await Promise.all([
          prisma.sendEmail.count({
            where: {
              result: "sent",
              isTest: false,
              batch: { workstreamId: ws.id },
            },
          }),
          prisma.sendEmail.count({
            where: {
              result: "sent",
              isTest: false,
              openedAt: { not: null },
              batch: { workstreamId: ws.id },
            },
          }),
        ]);
        return {
          workstreamId: ws.id,
          workstreamName: ws.name,
          sent,
          opened,
          openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        };
      })
    );

    // Unopened follow-ups (sent in last 7 days, not opened)
    const unopened = await prisma.sendEmail.findMany({
      where: {
        result: "sent",
        isTest: false,
        openedAt: null,
        sentAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        toEmail: true,
        toName: true,
        accountName: true,
        subject: true,
        sentAt: true,
        batch: {
          select: { workstream: { select: { name: true } } },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      enabled: true,
      overall: {
        totalSent,
        totalOpened,
        openRate:
          totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      },
      byWorkstream,
      unopenedRecent: unopened.map((e) => ({
        id: e.id,
        toEmail: e.toEmail,
        toName: e.toName,
        accountName: e.accountName,
        subject: e.subject,
        sentAt: e.sentAt,
        workstreamName: e.batch.workstream.name,
      })),
    });
  } catch (error) {
    console.error("Open tracking report error:", error);
    return NextResponse.json(
      { error: "Failed to generate open tracking report" },
      { status: 500 }
    );
  }
}
