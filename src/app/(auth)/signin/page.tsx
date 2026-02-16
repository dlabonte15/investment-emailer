"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else if (result?.url) {
      router.push(result.url);
    }
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md bg-red-900/40 border border-red-700 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-deloitte focus:outline-none focus:ring-1 focus:ring-deloitte"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter any password"
            className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-deloitte focus:outline-none focus:ring-1 focus:ring-deloitte"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-deloitte px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-deloitte-dark focus:outline-none focus:ring-2 focus:ring-deloitte focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-colors"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="mt-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-900 px-2 text-slate-500">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signIn("azure-ad", { callbackUrl })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 23 23" fill="none">
            <path d="M11 0H0v11h11V0Z" fill="#F25022" />
            <path d="M23 0H12v11h11V0Z" fill="#7FBA00" />
            <path d="M11 12H0v11h11V12Z" fill="#00A4EF" />
            <path d="M23 12H12v11h11V12Z" fill="#FFB900" />
          </svg>
          Sign in with Microsoft
        </button>
      </div>
    </>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">
            Deloitte<span className="text-deloitte">.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">Investment Emailer</p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
          <h2 className="mb-6 text-center text-lg font-semibold text-slate-200">
            Sign in to your account
          </h2>

          <Suspense fallback={<div className="h-64 animate-pulse rounded bg-slate-800" />}>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
