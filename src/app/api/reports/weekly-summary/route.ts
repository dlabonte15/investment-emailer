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
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Get all workstreams
    const workstreams = await prisma.workstream.findMany({
      select: { id: true, name: true },
    });

    // Emails per workstream this week
    const emailsByWorkstream = await Promise.all(
      workstreams.map(async (ws) => {
        const [sent, failed, skipped] = await Promise.all([
          prisma.sendEmail.count({
            where: {
              result: "sent",
              sentAt: { gte: sevenDaysAgo },
              batch: { workstreamId: ws.id },
            },
          }),
          prisma.sendEmail.count({
            where: {
              result: "failed",
              sentAt: { gte: sevenDaysAgo },
              batch: { workstreamId: ws.id },
            },
          }),
          prisma.sendEmail.count({
            where: {
              result: "skipped",
              sentAt: { gte: sevenDaysAgo },
              batch: { workstreamId: ws.id },
            },
          }),
        ]);
        return {
          workstreamId: ws.id,
          workstreamName: ws.name,
          sent,
          failed,
          skipped,
          total: sent + failed + skipped,
          successRate: sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 0,
        };
      })
    );

    // Weekly totals
    const totalSent = emailsByWorkstream.reduce((s, w) => s + w.sent, 0);
    const totalFailed = emailsByWorkstream.reduce((s, w) => s + w.failed, 0);

    // Escalation count
    const escalationCount = await prisma.escalation.count({
      where: { resolved: false },
    });

    // Week-over-week trend (emails per week for last 4 weeks)
    const weeklyTrend = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(
        now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000
      );
      const weekEnd = new Date(
        now.getTime() - i * 7 * 24 * 60 * 60 * 1000
      );
      const count = await prisma.sendEmail.count({
        where: {
          result: "sent",
          sentAt: { gte: weekStart, lt: weekEnd },
        },
      });
      weeklyTrend.unshift({
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        sent: count,
      });
    }

    // Batches this week
    const batchesThisWeek = await prisma.sendBatch.count({
      where: { startedAt: { gte: sevenDaysAgo } },
    });

    return NextResponse.json({
      period: {
        from: sevenDaysAgo.toISOString(),
        to: now.toISOString(),
      },
      totals: {
        sent: totalSent,
        failed: totalFailed,
        successRate:
          totalSent + totalFailed > 0
            ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
            : 0,
        batches: batchesThisWeek,
        escalations: escalationCount,
      },
      byWorkstream: emailsByWorkstream,
      weeklyTrend,
    });
  } catch (error) {
    console.error("Weekly summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly summary" },
      { status: 500 }
    );
  }
}
