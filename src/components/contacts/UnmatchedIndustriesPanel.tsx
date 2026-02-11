"use client";

import { useCallback, useEffect, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";

export default function UnmatchedIndustriesPanel({
  refreshKey,
  onQuickAdd,
}: {
  refreshKey: number;
  onQuickAdd?: () => void;
}) {
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const fetchUnmatched = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts/unmatched");
      if (res.ok) {
        const data = await res.json();
        setUnmatched(data.unmatched || []);
      }
    } catch {
      // Silently fail — this is informational
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnmatched();
  }, [fetchUnmatched, refreshKey]);

  const handleQuickAdd = async (industry: string) => {
    setAdding(industry);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryIndustry: industry,
          selName: "",
          selEmail: "",
          opsManagerName: "",
          opsManagerEmail: "",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess(`Added "${industry}" — fill in contact details in the table`);
      setUnmatched((prev) => prev.filter((i) => i !== industry));
      onQuickAdd?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(null);
    }
  };

  if (loading) return null;
  if (unmatched.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="h-5 w-5 text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h3 className="text-sm font-medium text-amber-300">
          Unmatched Industries ({unmatched.length})
        </h3>
      </div>
      <p className="text-xs text-amber-400/70 mb-3">
        These industries appear in the loaded investment data but have no contact
        mapping. Emails referencing these industries will be missing SEL/Ops
        Manager contacts.
      </p>
      <div className="space-y-1.5">
        {unmatched.map((industry) => (
          <div
            key={industry}
            className="flex items-center justify-between rounded-md bg-slate-900/50 px-3 py-2"
          >
            <span className="text-sm text-slate-300">{industry}</span>
            <button
              onClick={() => handleQuickAdd(industry)}
              disabled={adding === industry}
              className="rounded px-2.5 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
            >
              {adding === industry ? "Adding..." : "Quick Add"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
