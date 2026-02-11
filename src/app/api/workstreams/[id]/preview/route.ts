import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvestments } from "@/lib/data-store";

/**
 * Evaluate a single condition against a row value.
 */
function evaluateCondition(
  rowValue: string | number | null | undefined,
  operator: string,
  conditionValue: string | number | string[]
): boolean {
  const strValue = rowValue === null || rowValue === undefined ? "" : String(rowValue).trim();

  switch (operator) {
    case "equals":
      return strValue.toLowerCase() === String(conditionValue).toLowerCase();
    case "not_equals":
      return strValue.toLowerCase() !== String(conditionValue).toLowerCase();
    case "in": {
      const list = Array.isArray(conditionValue)
        ? conditionValue
        : String(conditionValue).split(",").map((s) => s.trim());
      return list.some((v) => v.toLowerCase() === strValue.toLowerCase());
    }
    case "not_in": {
      const list = Array.isArray(conditionValue)
        ? conditionValue
        : String(conditionValue).split(",").map((s) => s.trim());
      return !list.some((v) => v.toLowerCase() === strValue.toLowerCase());
    }
    case "contains":
      return strValue.toLowerCase().includes(String(conditionValue).toLowerCase());
    case "not_contains":
      return !strValue.toLowerCase().includes(String(conditionValue).toLowerCase());
    case "is_empty":
      return strValue === "";
    case "is_not_empty":
      return strValue !== "";
    case "greater_than":
      return parseFloat(strValue) > parseFloat(String(conditionValue));
    case "less_than":
      return parseFloat(strValue) < parseFloat(String(conditionValue));
    case "older_than_days": {
      if (!strValue) return false;
      const date = new Date(strValue);
      if (isNaN(date.getTime())) return false;
      const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo > Number(conditionValue);
    }
    case "newer_than_days": {
      if (!strValue) return false;
      const date = new Date(strValue);
      if (isNaN(date.getTime())) return false;
      const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo < Number(conditionValue);
    }
    default:
      return false;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workstream = await prisma.workstream.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!workstream) {
      return NextResponse.json(
        { error: "Workstream not found" },
        { status: 404 }
      );
    }

    const data = await getInvestments();
    if (!data) {
      return NextResponse.json({
        matchCount: 0,
        totalRows: 0,
        message: "No investment data loaded",
      });
    }

    const triggerRaw = workstream.triggerLogic;
    const trigger = (typeof triggerRaw === "string" ? JSON.parse(triggerRaw) : triggerRaw) as {
      conditions: { field: string; operator: string; value: string | number | string[] }[];
      logic: "AND" | "OR";
    };

    let matchCount = 0;
    for (const row of data.rows) {
      const results = trigger.conditions.map((c) =>
        evaluateCondition(
          row[c.field] as string | number | null | undefined,
          c.operator,
          c.value
        )
      );

      const matches =
        trigger.conditions.length === 0
          ? true
          : trigger.logic === "AND"
            ? results.every(Boolean)
            : results.some(Boolean);

      if (matches) matchCount++;
    }

    return NextResponse.json({
      matchCount,
      totalRows: data.rows.length,
    });
  } catch (error) {
    console.error("Workstream preview error:", error);
    return NextResponse.json(
      { error: "Failed to preview workstream" },
      { status: 500 }
    );
  }
}
