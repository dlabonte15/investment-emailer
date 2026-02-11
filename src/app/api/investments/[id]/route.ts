import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvestments } from "@/lib/data-store";
import { prisma } from "@/lib/prisma";

// GET /api/investments/[id] — Get investment detail + email timeline
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const investmentId = decodeURIComponent(params.id);

  // Load investment data from stored Excel
  const data = await getInvestments();
  if (!data) {
    return NextResponse.json(
      { error: "No investment data loaded" },
      { status: 404 }
    );
  }

  const row = data.rows.find(
    (r) => String(r.investment_id || "") === investmentId
  );
  if (!row) {
    return NextResponse.json(
      { error: "Investment not found" },
      { status: 404 }
    );
  }

  // Get all emails sent for this investment
  const emails = await prisma.sendEmail.findMany({
    where: { investmentId },
    include: {
      batch: {
        include: {
          workstream: { select: { name: true } },
        },
      },
    },
    orderBy: { sentAt: "desc" },
  });

  // Get escalation info
  const escalation = await prisma.escalation.findFirst({
    where: { investmentId },
    orderBy: { createdAt: "desc" },
  });

  // Get notes
  const notes = await prisma.investmentNote.findMany({
    where: { investmentId },
    orderBy: { createdAt: "desc" },
  });

  // Build all fields from the Excel row
  const fields: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(row)) {
    fields[key] = value;
  }

  return NextResponse.json({
    investmentId,
    fields,
    emailTimeline: emails.map((e) => ({
      id: e.id,
      workstreamName: e.batch.workstream.name,
      toEmail: e.toEmail,
      toName: e.toName,
      ccEmails: e.ccEmails,
      subject: e.subject,
      body: e.body,
      result: e.result,
      errorMessage: e.errorMessage,
      isTest: e.isTest,
      openedAt: e.openedAt,
      openCount: e.openCount,
      sentAt: e.sentAt,
    })),
    escalation: escalation
      ? {
          id: escalation.id,
          sendCount: escalation.sendCount,
          currentStatus: escalation.currentStatus,
          firstEmailedAt: escalation.firstEmailedAt,
          lastEmailedAt: escalation.lastEmailedAt,
          resolved: escalation.resolved,
          resolvedAt: escalation.resolvedAt,
          resolvedBy: escalation.resolvedBy,
          notes: escalation.notes,
        }
      : null,
    notes: notes.map((n) => ({
      id: n.id,
      note: n.note,
      createdBy: n.createdBy,
      createdAt: n.createdAt,
    })),
  });
}
