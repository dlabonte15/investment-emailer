import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/api/auth/signin",
  },
});

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /api/auth (NextAuth endpoints)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, etc.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
