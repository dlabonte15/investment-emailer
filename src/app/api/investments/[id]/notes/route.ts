import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/investments/[id]/notes — Get notes for an investment
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const investmentId = decodeURIComponent(params.id);

  const notes = await prisma.investmentNote.findMany({
    where: { investmentId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    notes.map((n) => ({
      id: n.id,
      note: n.note,
      createdBy: n.createdBy,
      createdAt: n.createdAt,
    }))
  );
}

// POST /api/investments/[id]/notes — Add a note to an investment
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const investmentId = decodeURIComponent(params.id);

  const body = await req.json();
  const { note } = body;

  if (!note || typeof note !== "string" || !note.trim()) {
    return NextResponse.json(
      { error: "Note text is required" },
      { status: 400 }
    );
  }

  const created = await prisma.investmentNote.create({
    data: {
      investmentId,
      note: note.trim(),
      createdBy: session.user.email,
    },
  });

  return NextResponse.json({
    id: created.id,
    note: created.note,
    createdBy: created.createdBy,
    createdAt: created.createdAt,
  });
}
