import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// GET /api/reports/export — Export report data as Excel or PDF
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "weekly";
    const format = searchParams.get("format") || "xlsx";
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Gather data for all requested sections
    const sections: { title: string; headers: string[]; rows: string[][] }[] =
      [];

    if (type === "weekly" || type === "all") {
      const workstreams = await prisma.workstream.findMany({
        select: { id: true, name: true },
      });

      const rows = await Promise.all(
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
          const successRate =
            sent + failed > 0
              ? `${Math.round((sent / (sent + failed)) * 100)}%`
              : "N/A";
          return [
            ws.name,
            String(sent),
            String(failed),
            String(skipped),
            String(sent + failed + skipped),
            successRate,
          ];
        })
      );

      sections.push({
        title: "Weekly Summary",
        headers: [
          "Workstream",
          "Sent",
          "Failed",
          "Skipped",
          "Total",
          "Success Rate",
        ],
        rows,
      });
    }

    if (type === "emails" || type === "all") {
      const emails = await prisma.sendEmail.findMany({
        where: { sentAt: { gte: sevenDaysAgo } },
        include: {
          batch: {
            select: { workstream: { select: { name: true } } },
          },
        },
        orderBy: { sentAt: "desc" },
      });

      sections.push({
        title: "Emails",
        headers: [
          "Sent At",
          "Workstream",
          "Investment ID",
          "Account",
          "Investment",
          "To",
          "CC",
          "Subject",
          "Result",
          "Error",
          "Is Test",
        ],
        rows: emails.map((e) => [
          e.sentAt.toISOString(),
          e.batch.workstream.name,
          e.investmentId,
          e.accountName,
          e.investmentName,
          e.toEmail,
          e.ccEmails || "",
          e.subject,
          e.result,
          e.errorMessage || "",
          e.isTest ? "Yes" : "No",
        ]),
      });
    }

    if (type === "escalations" || type === "all") {
      const escalations = await prisma.escalation.findMany({
        include: { workstream: { select: { name: true } } },
        orderBy: { lastEmailedAt: "desc" },
      });

      sections.push({
        title: "Escalations",
        headers: [
          "Investment ID",
          "Account",
          "Investment",
          "Status",
          "Workstream",
          "Send Count",
          "First Emailed",
          "Last Emailed",
          "Resolved",
          "Notes",
        ],
        rows: escalations.map((e) => [
          e.investmentId,
          e.accountName,
          e.investmentName,
          e.currentStatus,
          e.workstream.name,
          String(e.sendCount),
          e.firstEmailedAt.toISOString(),
          e.lastEmailedAt.toISOString(),
          e.resolved ? "Yes" : "No",
          e.notes || "",
        ]),
      });
    }

    // ── PDF format ──────────────────────────────────────────────────────
    if (format === "pdf") {
      // Dynamic import so the server-side module loads correctly
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape" });

      sections.forEach((section, idx) => {
        if (idx > 0) doc.addPage();

        doc.setFontSize(16);
        doc.text(section.title, 14, 20);
        doc.setFontSize(8);
        doc.text(
          `Generated ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
          14,
          27
        );

        autoTable(doc, {
          startY: 32,
          head: [section.headers],
          body: section.rows,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [41, 65, 122] },
          alternateRowStyles: { fillColor: [240, 240, 240] },
        });
      });

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
      const fileName = `investment-report-${now.toISOString().slice(0, 10)}.pdf`;

      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    // ── Excel format (default) ──────────────────────────────────────────
    const workbook = XLSX.utils.book_new();

    for (const section of sections) {
      const sheetRows = section.rows.map((row) => {
        const obj: Record<string, string> = {};
        section.headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });
      const sheet = XLSX.utils.json_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(workbook, sheet, section.title);
    }

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const fileName = `investment-report-${now.toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Report export error:", error);
    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 }
    );
  }
}
