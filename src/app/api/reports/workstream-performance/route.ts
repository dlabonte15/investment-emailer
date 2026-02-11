import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const weeks = parseInt(searchParams.get("weeks") || "12");
    const now = new Date();

    const workstreams = await prisma.workstream.findMany({
      select: { id: true, name: true, enabled: true },
    });

    // Build per-workstream performance data over N weeks
    const performance = await Promise.all(
      workstreams.map(async (ws) => {
        const weeklyData = [];
        for (let i = 0; i < weeks; i++) {
          const weekStart = new Date(
            now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000
          );
          const weekEnd = new Date(
            now.getTime() - i * 7 * 24 * 60 * 60 * 1000
          );

          const [sent, failed] = await Promise.all([
            prisma.sendEmail.count({
              where: {
                result: "sent",
                sentAt: { gte: weekStart, lt: weekEnd },
                batch: { workstreamId: ws.id },
              },
            }),
            prisma.sendEmail.count({
              where: {
                result: "failed",
                sentAt: { gte: weekStart, lt: weekEnd },
                batch: { workstreamId: ws.id },
              },
            }),
          ]);

          weeklyData.unshift({
            week: weekStart.toISOString().slice(0, 10),
            sent,
            failed,
            failureRate:
              sent + failed > 0
                ? Math.round((failed / (sent + failed)) * 100)
                : 0,
          });
        }

        // Total batches
        const totalBatches = await prisma.sendBatch.count({
          where: { workstreamId: ws.id },
        });

        // Total emails ever
        const totalEmails = await prisma.sendEmail.count({
          where: { batch: { workstreamId: ws.id } },
        });

        return {
          workstreamId: ws.id,
          workstreamName: ws.name,
          enabled: ws.enabled,
          totalBatches,
          totalEmails,
          weeklyData,
        };
      })
    );

    return NextResponse.json({ performance, weeks });
  } catch (error) {
    console.error("Workstream performance error:", error);
    return NextResponse.json(
      { error: "Failed to generate performance report" },
      { status: 500 }
    );
  }
}
