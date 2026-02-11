import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: "Unauthorized", status: 401, session: null };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "admin") {
    return { error: "Forbidden: Admin access required", status: 403, session: null };
  }

  return { error: null, status: 200, session };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Users GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { error, status, session } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await req.json();
    const { email, name, role } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    if (role && !["admin", "sender"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'sender'" },
        { status: 400 }
      );
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role: role || "sender" },
      create: { email, name, role: role || "sender" },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.user!.email!,
        action: "create",
        entityType: "User",
        entityId: String(user.id),
        newValue: JSON.stringify({ email, name, role: user.role }),
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Users POST error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { error, status, session } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-deletion
    if (user.email === session!.user.email) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: parseInt(userId) } });

    await prisma.auditLog.create({
      data: {
        userId: session!.user!.email!,
        action: "delete",
        entityType: "User",
        entityId: userId,
        oldValue: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Users DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
