import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

async function refreshAccessToken(token: any) {
  try {
    const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        scope: "openid profile email offline_access Mail.Send Files.Read.All User.Read",
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// Build providers list: always include Credentials, optionally include Azure AD
const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "you@example.com" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      // For local dev: accept any non-empty password
      const user = await prisma.user.upsert({
        where: { email: credentials.email },
        update: { lastLoginAt: new Date() },
        create: {
          email: credentials.email,
          name: credentials.email.split("@")[0],
          role: "sender",
        },
      });

      return {
        id: String(user.id),
        email: user.email,
        name: user.name,
        role: user.role,
      };
    },
  }),
];

// Only add Azure AD provider if env vars are configured
if (process.env.AZURE_AD_CLIENT_ID) {
  // Dynamic import isn't needed — conditional push keeps it simple
  const AzureADProvider = require("next-auth/providers/azure-ad").default;
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope:
            "openid profile email offline_access Mail.Send Files.Read.All User.Read",
        },
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Credentials sign-in: user object is returned by authorize()
      if (user && !account?.access_token) {
        token.role = (user as any).role;
        return token;
      }

      // Azure AD sign-in: persist tokens from the provider
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;

        // Upsert user record and set role
        const dbUser = await prisma.user.upsert({
          where: { email: token.email! },
          update: { lastLoginAt: new Date() },
          create: {
            email: token.email!,
            name: token.name ?? token.email!,
            role: "sender",
          },
        });
        token.role = dbUser.role;

        return token;
      }

      // No access token means credentials login — no refresh needed
      if (!token.accessToken) {
        return token;
      }

      // Return token if it hasn't expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Token has expired — refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      session.user.role = token.role as string;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
