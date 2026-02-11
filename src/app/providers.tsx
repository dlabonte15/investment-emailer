"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#f8fafc",
            border: "1px solid #334155",
          },
          success: {
            iconTheme: { primary: "#22c55e", secondary: "#f8fafc" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#f8fafc" },
          },
        }}
      />
    </SessionProvider>
  );
}
