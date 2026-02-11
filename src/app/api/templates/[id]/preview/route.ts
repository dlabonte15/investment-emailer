import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvestments } from "@/lib/data-store";
import { renderTemplate, buildSampleData } from "@/lib/template-renderer";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = parseInt(params.id);
    const body = await req.json().catch(() => ({}));

    // Allow passing subject/body directly for live preview, or load from DB
    let subject: string;
    let templateBody: string;
    let signature: string;
    let includeTable: boolean;
    let tableColumns: { header: string; placeholder: string }[] | null;

    if (body.subject !== undefined && body.body !== undefined) {
      // Live preview mode — use provided values
      subject = body.subject;
      templateBody = body.body;
      signature = body.signature ?? "Account Investment Concierge";
      includeTable = body.includeTable ?? false;
      tableColumns = body.tableColumns ?? null;
    } else {
      // Load from DB
      const template = await prisma.emailTemplate.findUnique({
        where: { id },
      });
      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      subject = template.subject;
      templateBody = template.body;
      signature = template.signature;
      includeTable = template.includeTable;
      const rawCols = template.tableColumns;
      tableColumns = typeof rawCols === "string"
        ? JSON.parse(rawCols) as { header: string; placeholder: string }[]
        : (rawCols as { header: string; placeholder: string }[] | null);
    }

    // Get sample data from loaded investments
    const data = await getInvestments();
    const sampleRow = data?.rows?.[0] || null;

    // Get contact mapping for sample row's industry
    let contactRow = null;
    if (sampleRow?.primary_industry) {
      contactRow = await prisma.industryContact.findUnique({
        where: {
          primaryIndustry: String(sampleRow.primary_industry),
        },
      });
    }

    // Get sender name
    const settings = await prisma.globalSettings.findFirst({
      where: { id: 1 },
    });

    const sampleData = buildSampleData(
      sampleRow as Record<string, string | number | null> | undefined,
      contactRow || undefined,
      settings?.defaultSenderName
    );

    const renderedSubject = renderTemplate(subject, sampleData);
    const renderedBody = renderTemplate(templateBody, sampleData);
    const renderedSignature = renderTemplate(signature, sampleData);

    // Render table if enabled
    let renderedTable: string | null = null;
    if (includeTable && tableColumns && tableColumns.length > 0) {
      const headers = tableColumns.map((c) => c.header);
      const values = tableColumns.map((c) =>
        renderTemplate(`{{${c.placeholder}}}`, sampleData)
      );
      renderedTable = JSON.stringify({ headers, rows: [values] });
    }

    return NextResponse.json({
      subject: renderedSubject,
      body: renderedBody,
      signature: renderedSignature,
      table: renderedTable,
      hasSampleData: !!sampleRow,
    });
  } catch (error) {
    console.error("Template preview error:", error);
    return NextResponse.json(
      { error: "Failed to render preview" },
      { status: 500 }
    );
  }
}
