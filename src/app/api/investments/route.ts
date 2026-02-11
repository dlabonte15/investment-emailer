import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvestments } from "@/lib/data-store";
import { prisma } from "@/lib/prisma";

// GET /api/investments — List all investments with email history stats
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const industryFilter = searchParams.get("industry") || "";
  const escalatedOnly = searchParams.get("escalated") === "true";
  const sortField = searchParams.get("sortField") || "investment_id";
  const sortDir = searchParams.get("sortDir") || "asc";

  // Load investment data from the stored Excel
  const data = await getInvestments();
  if (!data || data.rows.length === 0) {
    return NextResponse.json({
      investments: [],
      total: 0,
      page,
      totalPages: 0,
    });
  }

  // Get email counts per investment_id from the database
  const emailStats = await prisma.sendEmail.groupBy({
    by: ["investmentId"],
    _count: { id: true },
    _max: { sentAt: true },
    where: { result: "sent" },
  });

  const emailCountMap = new Map<string, { count: number; lastSentAt: Date | null }>();
  for (const stat of emailStats) {
    emailCountMap.set(stat.investmentId, {
      count: stat._count.id,
      lastSentAt: stat._max.sentAt,
    });
  }

  // Get escalation flags
  const escalations = await prisma.escalation.findMany({
    where: { resolved: false },
    select: { investmentId: true, sendCount: true },
  });
  const escalationMap = new Map<string, number>();
  for (const e of escalations) {
    escalationMap.set(e.investmentId, e.sendCount);
  }

  // Build enriched investment list
  let investments = data.rows.map((row) => {
    const investmentId = String(row.investment_id || "");
    const stats = emailCountMap.get(investmentId);
    return {
      investmentId,
      accountName: String(row.account_name || ""),
      investmentName: String(row.investment_name || ""),
      investmentStatus: String(row.investment_status || ""),
      jupiterStage: String(row.jupiter_stage || ""),
      primaryIndustry: String(row.primary_industry || ""),
      requestedAmount: row.requested_amount,
      approvedAmount: row.approved_amount,
      investmentLeader: String(row.investment_leader || ""),
      totalEmailsSent: stats?.count || 0,
      lastEmailed: stats?.lastSentAt?.toISOString() || null,
      escalationFlag: escalationMap.has(investmentId),
      escalationSendCount: escalationMap.get(investmentId) || 0,
    };
  });

  // Apply filters
  if (search) {
    const q = search.toLowerCase();
    investments = investments.filter(
      (inv) =>
        inv.investmentId.toLowerCase().includes(q) ||
        inv.accountName.toLowerCase().includes(q) ||
        inv.investmentName.toLowerCase().includes(q) ||
        inv.investmentLeader.toLowerCase().includes(q)
    );
  }
  if (statusFilter) {
    investments = investments.filter(
      (inv) => inv.investmentStatus.toLowerCase() === statusFilter.toLowerCase()
    );
  }
  if (industryFilter) {
    investments = investments.filter(
      (inv) => inv.primaryIndustry.toLowerCase() === industryFilter.toLowerCase()
    );
  }
  if (escalatedOnly) {
    investments = investments.filter((inv) => inv.escalationFlag);
  }

  // Sort
  investments.sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortField] ?? "";
    const bVal = (b as Record<string, unknown>)[sortField] ?? "";
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    const cmp = aStr.localeCompare(bStr, undefined, { numeric: true });
    return sortDir === "desc" ? -cmp : cmp;
  });

  const total = investments.length;
  const totalPages = Math.ceil(total / limit);
  const paged = investments.slice((page - 1) * limit, page * limit);

  // Collect unique statuses and industries for filter dropdowns
  const allStatuses = [...new Set(data.rows.map((r) => String(r.investment_status || "")).filter(Boolean))];
  const allIndustries = [...new Set(data.rows.map((r) => String(r.primary_industry || "")).filter(Boolean))];

  return NextResponse.json({
    investments: paged,
    total,
    page,
    totalPages,
    filters: { statuses: allStatuses, industries: allIndustries },
  });
}
