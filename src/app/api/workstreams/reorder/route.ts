import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/workstreams/reorder — Persist display order after drag-and-drop
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { orderedIds } = (await req.json()) as { orderedIds: number[] };

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { error: "orderedIds array is required" },
        { status: 400 }
      );
    }

    // Batch update each workstream's displayOrder
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.workstream.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Workstream reorder error:", error);
    return NextResponse.json(
      { error: "Failed to reorder workstreams" },
      { status: 500 }
    );
  }
}
