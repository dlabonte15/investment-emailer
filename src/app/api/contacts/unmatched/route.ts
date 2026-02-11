import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvestments } from "@/lib/data-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [data, contacts] = await Promise.all([
      getInvestments(),
      prisma.industryContact.findMany({
        select: { primaryIndustry: true },
      }),
    ]);

    if (!data) {
      return NextResponse.json({
        unmatched: [],
        message: "No investment data loaded",
      });
    }

    // Collect unique industries from loaded data
    const mappedIndustries = new Set(
      contacts.map((c) => c.primaryIndustry.toLowerCase().trim())
    );

    const industriesInData = new Set<string>();
    for (const row of data.rows) {
      const industry = row.primary_industry;
      if (industry && typeof industry === "string" && industry.trim()) {
        industriesInData.add(industry.trim());
      }
    }

    // Find unmatched
    const unmatched: string[] = [];
    for (const industry of industriesInData) {
      if (!mappedIndustries.has(industry.toLowerCase().trim())) {
        unmatched.push(industry);
      }
    }

    unmatched.sort();

    return NextResponse.json({ unmatched });
  } catch (error) {
    console.error("Unmatched industries error:", error);
    return NextResponse.json(
      { error: "Failed to check unmatched industries" },
      { status: 500 }
    );
  }
}
