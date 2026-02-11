import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF as a Buffer
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// GET /api/track/open/[emailId] — Tracking pixel endpoint
export async function GET(
  _req: NextRequest,
  { params }: { params: { emailId: string } }
) {
  const emailId = parseInt(params.emailId);

  if (!isNaN(emailId)) {
    try {
      const email = await prisma.sendEmail.findUnique({
        where: { id: emailId },
      });

      if (email) {
        await prisma.sendEmail.update({
          where: { id: emailId },
          data: {
            openCount: { increment: 1 },
            // Set openedAt only on first open
            ...(!email.openedAt ? { openedAt: new Date() } : {}),
          },
        });
      }
    } catch (error) {
      // Silently fail — don't break email rendering if tracking fails
      console.error("Tracking pixel error:", error);
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
