import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSchedulerStatus } from "@/lib/scheduler";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = getSchedulerStatus();
  return NextResponse.json({
    nextRuns: status.jobs
      .filter((j) => j.nextRun)
      .sort(
        (a, b) =>
          new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime()
      ),
  });
}
