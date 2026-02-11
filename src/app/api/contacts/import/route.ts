import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No rows found in the uploaded file" },
        { status: 400 }
      );
    }

    // Map common header variations to our fields
    const headerMap: Record<string, string> = {
      "primary industry": "primaryIndustry",
      "industry": "primaryIndustry",
      "sel name": "selName",
      "sel email": "selEmail",
      "ops manager name": "opsManagerName",
      "ops manager email": "opsManagerEmail",
      "concierge name": "conciergeName",
      "concierge email": "conciergeEmail",
    };

    const mapRow = (raw: Record<string, string>) => {
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        const normalized = key.toLowerCase().trim();
        const field = headerMap[normalized];
        if (field) mapped[field] = value.trim();
      }
      return mapped;
    };

    // Fetch old data for audit
    const oldContacts = await prisma.industryContact.findMany();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of rows) {
      const mapped = mapRow(raw);
      if (!mapped.primaryIndustry || !mapped.selName || !mapped.selEmail) {
        skipped++;
        continue;
      }

      await prisma.industryContact.upsert({
        where: { primaryIndustry: mapped.primaryIndustry },
        update: {
          selName: mapped.selName,
          selEmail: mapped.selEmail,
          opsManagerName: mapped.opsManagerName || "",
          opsManagerEmail: mapped.opsManagerEmail || "",
          ...(mapped.conciergeName && { conciergeName: mapped.conciergeName }),
          ...(mapped.conciergeEmail && { conciergeEmail: mapped.conciergeEmail }),
        },
        create: {
          primaryIndustry: mapped.primaryIndustry,
          selName: mapped.selName,
          selEmail: mapped.selEmail,
          opsManagerName: mapped.opsManagerName || "",
          opsManagerEmail: mapped.opsManagerEmail || "",
          conciergeName:
            mapped.conciergeName ||
            "US Consulting Account Investment Concierge",
          conciergeEmail:
            mapped.conciergeEmail ||
            "accountinvestmentcommittee@deloitte.com",
        },
      });

      const existed = oldContacts.some(
        (c) => c.primaryIndustry === mapped.primaryIndustry
      );
      if (existed) updated++;
      else created++;
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.email,
        action: "import",
        entityType: "IndustryContact",
        newValue: JSON.stringify({ created, updated, skipped, totalRows: rows.length }),
      },
    });

    return NextResponse.json({ created, updated, skipped, totalRows: rows.length });
  } catch (error) {
    console.error("Contact import error:", error);
    return NextResponse.json(
      { error: "Failed to import contacts" },
      { status: 500 }
    );
  }
}
