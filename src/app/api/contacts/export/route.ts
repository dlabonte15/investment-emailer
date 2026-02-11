import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contacts = await prisma.industryContact.findMany({
      orderBy: { primaryIndustry: "asc" },
    });

    const rows = contacts.map((c) => ({
      "Primary Industry": c.primaryIndustry,
      "SEL Name": c.selName,
      "SEL Email": c.selEmail,
      "Ops Manager Name": c.opsManagerName,
      "Ops Manager Email": c.opsManagerEmail,
      "Concierge Name": c.conciergeName,
      "Concierge Email": c.conciergeEmail,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 40 }, // Primary Industry
      { wch: 20 }, // SEL Name
      { wch: 30 }, // SEL Email
      { wch: 20 }, // Ops Manager Name
      { wch: 30 }, // Ops Manager Email
      { wch: 45 }, // Concierge Name
      { wch: 45 }, // Concierge Email
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Contact Mappings");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="contact-mappings.xlsx"',
      },
    });
  } catch (error) {
    console.error("Contact export error:", error);
    return NextResponse.json(
      { error: "Failed to export contacts" },
      { status: 500 }
    );
  }
}
