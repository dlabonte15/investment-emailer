import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Require the caller to have the "admin" role. Returns the session if
 * authorised, or a JSON error response (401/403) that the route handler
 * should return immediately.
 *
 * Usage:
 *   const auth = await requireAdmin();
 *   if (auth.error) return auth.error;
 *   const session = auth.session;
 */
export async function requireAdmin(): Promise<
  | { error: NextResponse; session?: never }
  | { error?: never; session: { user: { email: string; role: string }; accessToken?: string } }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (session.user.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      ),
    };
  }

  return {
    session: session as { user: { email: string; role: string }; accessToken?: string },
  };
}
