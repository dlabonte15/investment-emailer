import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// GET /api/batches/export — Export send history as CSV or Excel
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workstreamId = searchParams.get("workstreamId");
  const status = searchParams.get("status");
  const format = searchParams.get("format") || "csv";

  const where: Record<string, unknown> = {};
  if (workstreamId) {
    where.batch = { workstreamId: parseInt(workstreamId) };
  }
  if (status) {
    where.result = status;
  }

  const emails = await prisma.sendEmail.findMany({
    where,
    include: {
      batch: {
        include: {
          workstream: { select: { name: true } },
        },
      },
    },
    orderBy: { sentAt: "desc" },
    take: 5000,
  });

  const headers = [
    "Date",
    "Workstream",
    "Trigger Type",
    "Investment ID",
    "Account",
    "Investment Name",
    "To Email",
    "CC Emails",
    "Subject",
    "Result",
    "Error",
    "Is Test",
  ];

  const rows = emails.map((e) => [
    e.sentAt.toISOString(),
    e.batch.workstream.name,
    e.batch.triggerType,
    e.investmentId,
    e.accountName,
    e.investmentName,
    e.toEmail,
    e.ccEmails || "",
    e.subject,
    e.result,
    e.errorMessage || "",
    e.isTest ? "Yes" : "No",
  ]);

  const dateStr = new Date().toISOString().split("T")[0];

  // ── Excel format ────────────────────────────────────────────────────
  if (format === "xlsx") {
    const sheetRows = rows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Send History");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="send-history-${dateStr}.xlsx"`,
      },
    });
  }

  // ── CSV format (default) ────────────────────────────────────────────
  const csvContent = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=send-history-${dateStr}.csv`,
    },
  });
}
