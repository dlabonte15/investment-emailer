import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/signin",
  },
});

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /api/auth (NextAuth endpoints)
     * - /signin (custom sign-in page)
     * - /_next (Next.js internals)
     * - /favicon.ico, /images, etc.
     */
    "/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)",
  ],
};
