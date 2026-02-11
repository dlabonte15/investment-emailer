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

    const [
      workstreams,
      emailsSentThisWeek,
      pendingBatches,
      escalationCount,
      recentEmails,
      lastDataLoad,
      settings,
    ] = await Promise.all([
      // All workstreams with last batch info
      prisma.workstream.findMany({
        include: {
          template: { select: { id: true, name: true } },
          batches: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: {
              id: true,
              startedAt: true,
              status: true,
              sentCount: true,
              failedCount: true,
              totalCount: true,
            },
          },
        },
        orderBy: { id: "asc" },
      }),
      // Emails sent in last 7 days
      prisma.sendEmail.count({
        where: {
          result: "sent",
          sentAt: { gte: sevenDaysAgo },
        },
      }),
      // Pending approval batches
      prisma.sendBatch.findMany({
        where: { status: "pending_approval" },
        include: {
          workstream: { select: { name: true } },
          _count: { select: { emails: true } },
        },
        orderBy: { startedAt: "desc" },
      }),
      // Open escalations
      prisma.escalation.count({
        where: { resolved: false },
      }),
      // Recent activity (last 20 emails)
      prisma.sendEmail.findMany({
        orderBy: { sentAt: "desc" },
        take: 20,
        include: {
          batch: {
            select: {
              workstream: { select: { name: true } },
              triggerType: true,
            },
          },
        },
      }),
      // Last data load
      prisma.dataLoadLog.findFirst({
        orderBy: { loadedAt: "desc" },
      }),
      // Settings
      prisma.globalSettings.findFirst({ where: { id: 1 } }),
    ]);

    // Count active workstreams
    const activeWorkstreams = workstreams.filter((w) => w.enabled).length;

    // Format workstream cards
    const workstreamCards = workstreams.map((w) => {
      const lastBatch = w.batches[0] || null;
      return {
        id: w.id,
        name: w.name,
        description: w.description,
        enabled: w.enabled,
        cadence: w.cadence,
        cronExpression: w.cronExpression,
        lastRunAt: w.lastRunAt,
        nextRunAt: w.nextRunAt,
        templateName: w.template.name,
        lastBatch: lastBatch
          ? {
              id: lastBatch.id,
              startedAt: lastBatch.startedAt,
              status: lastBatch.status,
              sentCount: lastBatch.sentCount,
              failedCount: lastBatch.failedCount,
              totalCount: lastBatch.totalCount,
            }
          : null,
      };
    });

    // Format pending batches
    const pendingApproval = pendingBatches.map((b) => ({
      id: b.id,
      workstreamName: b.workstream.name,
      emailCount: b._count.emails,
      startedAt: b.startedAt,
    }));

    // Format recent activity
    const recentActivity = recentEmails.map((e) => ({
      id: e.id,
      workstreamName: e.batch.workstream.name,
      triggerType: e.batch.triggerType,
      toEmail: e.toEmail,
      toName: e.toName,
      accountName: e.accountName,
      investmentName: e.investmentName,
      subject: e.subject,
      result: e.result,
      isTest: e.isTest,
      sentAt: e.sentAt,
      errorMessage: e.errorMessage,
    }));

    // Data freshness
    const warningThreshold = settings?.dataFreshnessWarningDays ?? 7;
    const daysSinceLoad = lastDataLoad
      ? Math.floor(
          (now.getTime() - lastDataLoad.loadedAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    return NextResponse.json({
      summary: {
        activeWorkstreams,
        totalWorkstreams: workstreams.length,
        emailsSentThisWeek,
        pendingApprovalCount: pendingBatches.reduce(
          (sum, b) => sum + b._count.emails,
          0
        ),
        escalationCount,
      },
      workstreamCards,
      pendingApproval,
      recentActivity,
      dataFreshness: {
        lastLoad: lastDataLoad
          ? {
              sourceType: lastDataLoad.sourceType,
              fileName: lastDataLoad.fileName,
              rowCount: lastDataLoad.rowCount,
              loadedAt: lastDataLoad.loadedAt.toISOString(),
              loadedBy: lastDataLoad.loadedBy,
            }
          : null,
        daysSinceLoad,
        warningThreshold,
        isStale: daysSinceLoad !== null && daysSinceLoad > warningThreshold,
      },
    });
  } catch (error) {
    console.error("Dashboard GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
