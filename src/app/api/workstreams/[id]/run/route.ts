import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runWorkstreamTrigger } from "@/lib/trigger-engine";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`workstream-run:${session.user.email}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const result = await runWorkstreamTrigger(
      parseInt(params.id),
      session.user.email,
      "manual"
    );

    return NextResponse.json({
      batchId: result.batchId,
      workstreamName: result.workstreamName,
      totalMatched: result.totalMatched,
      totalEmails: result.totalEmails,
      skippedDedupe: result.skippedDedupe,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error("Workstream run error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to run workstream";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
