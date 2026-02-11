"use client";

import { useEffect, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";

interface StatusData {
  lastLoad: {
    sourceType: string;
    fileName: string | null;
    rowCount: number;
    loadedAt: string;
    loadedBy: string;
  } | null;
  daysSinceLoad: number | null;
  warningThreshold: number;
  isStale: boolean;
}

export default function DataFreshnessBanner() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = () => {
    fetch("/api/data/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStatus(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRefreshOneDrive = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/data/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      showSuccess(`Refreshed: ${data.rowCount} rows loaded from ${data.fileName}`);
      fetchStatus();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to refresh from OneDrive");
    } finally {
      setRefreshing(false);
    }
  };

  // No data loaded at all
  if (status && !status.lastLoad) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-900/20 p-3">
        <div className="flex items-center gap-2">
          <WarningIcon color="amber" />
          <p className="text-sm text-amber-300">
            No investment data loaded. Upload an Excel file or refresh from
            OneDrive to get started.
          </p>
        </div>
        <a
          href="/settings"
          className="rounded px-3 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
        >
          Upload Data
        </a>
      </div>
    );
  }

  // Data loaded but not stale — don't show banner
  if (!status || !status.lastLoad || !status.isStale) {
    return null;
  }

  const isVeryStale =
    status.daysSinceLoad !== null &&
    status.daysSinceLoad > status.warningThreshold * 2;

  return (
    <div
      className={`
        mb-4 flex items-center justify-between rounded-lg border p-3
        ${
          isVeryStale
            ? "border-red-500/30 bg-red-900/20"
            : "border-amber-500/30 bg-amber-900/20"
        }
      `}
    >
      <div className="flex items-center gap-2">
        <WarningIcon color={isVeryStale ? "red" : "amber"} />
        <p
          className={`text-sm ${isVeryStale ? "text-red-300" : "text-amber-300"}`}
        >
          Data last refreshed{" "}
          <span className="font-medium">{status.daysSinceLoad} days ago</span>
          {status.lastLoad.fileName && (
            <span className="text-slate-400">
              {" "}
              ({status.lastLoad.fileName})
            </span>
          )}
          . Please refresh your Zenith export to ensure accuracy.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefreshOneDrive}
          disabled={refreshing}
          className={`
            rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap
            ${
              isVeryStale
                ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            }
            disabled:opacity-50
          `}
        >
          {refreshing ? "Refreshing..." : "Refresh from OneDrive"}
        </button>
        <a
          href="/settings"
          className={`
            rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap
            ${
              isVeryStale
                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
            }
          `}
        >
          Upload File
        </a>
      </div>
    </div>
  );
}

function WarningIcon({ color }: { color: "red" | "amber" }) {
  return (
    <svg
      className={`h-5 w-5 ${color === "red" ? "text-red-400" : "text-amber-400"}`}
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
  );
}
