"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import DataFreshnessBanner from "@/components/DataFreshnessBanner";
import { showSuccess, showError } from "@/components/ToastProvider";

interface DashboardData {
  summary: {
    activeWorkstreams: number;
    totalWorkstreams: number;
    emailsSentThisWeek: number;
    pendingApprovalCount: number;
    escalationCount: number;
  };
  workstreamCards: WorkstreamCard[];
  pendingApproval: PendingBatch[];
  recentActivity: ActivityItem[];
  dataFreshness: {
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
  };
}

interface WorkstreamCard {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  cadence: string;
  cronExpression: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  templateName: string;
  lastBatch: {
    id: number;
    startedAt: string;
    status: string;
    sentCount: number;
    failedCount: number;
    totalCount: number;
  } | null;
}

interface PendingBatch {
  id: number;
  workstreamName: string;
  emailCount: number;
  startedAt: string;
}

interface ActivityItem {
  id: number;
  workstreamName: string;
  triggerType: string;
  toEmail: string;
  toName: string | null;
  accountName: string;
  investmentName: string;
  subject: string;
  result: string;
  isTest: boolean;
  sentAt: string;
  errorMessage: string | null;
}

interface EscalationItem {
  id: number;
  workstreamName: string;
  investmentId: string;
  accountName: string;
  investmentName: string;
  currentStatus: string;
  sendCount: number;
  firstEmailedAt: string;
  lastEmailedAt: string;
  notes: string | null;
}

interface UnmatchedData {
  unmatched: string[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningWorkstream, setRunningWorkstream] = useState<number | null>(
    null
  );
  const [togglingWorkstream, setTogglingWorkstream] = useState<number | null>(
    null
  );
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, escRes, unmRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/escalations?resolved=false&limit=10"),
        fetch("/api/contacts/unmatched"),
      ]);

      if (dashRes.ok) setData(await dashRes.json());
      if (escRes.ok) {
        const escData = await escRes.json();
        setEscalations(escData.escalations || []);
      }
      if (unmRes.ok) {
        const unmData: UnmatchedData = await unmRes.json();
        setUnmatched(unmData.unmatched || []);
      }
    } catch {
      showError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleToggleWorkstream = async (ws: WorkstreamCard) => {
    setTogglingWorkstream(ws.id);
    try {
      const res = await fetch(`/api/workstreams/${ws.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !ws.enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      showSuccess(`${ws.name} ${ws.enabled ? "disabled" : "enabled"}`);
      fetchDashboard();
    } catch {
      showError("Failed to toggle workstream");
    } finally {
      setTogglingWorkstream(null);
    }
  };

  const handleRunWorkstream = async (ws: WorkstreamCard) => {
    setRunningWorkstream(ws.id);
    try {
      const res = await fetch(`/api/workstreams/${ws.id}/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to run");
      }
      const result = await res.json();
      showSuccess(
        `Batch created with ${result.emailCount ?? result.totalCount ?? 0} emails`
      );
      fetchDashboard();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to run workstream"
      );
    } finally {
      setRunningWorkstream(null);
    }
  };

  const handleResolveEscalation = async (id: number) => {
    try {
      const res = await fetch(`/api/escalations/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to resolve");
      showSuccess("Escalation resolved");
      fetchDashboard();
    } catch {
      showError("Failed to resolve escalation");
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Deloitte investment email automation overview"
        />
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-4 h-24"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-40"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Deloitte investment email automation overview"
      />

      <DataFreshnessBanner />

      {/* Pending Approval Banner */}
      {data && data.pendingApproval.length > 0 && (
        <div className="mb-4 rounded-lg border border-deloitte/30 bg-deloitte-dark/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-deloitte"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-deloitte-light">
                <span className="font-medium">
                  {data.pendingApproval.reduce(
                    (s, b) => s + b.emailCount,
                    0
                  )}{" "}
                  emails
                </span>{" "}
                queued from{" "}
                {data.pendingApproval
                  .map((b) => b.workstreamName)
                  .join(", ")}{" "}
                &mdash; Review & Approve
              </p>
            </div>
            <Link
              href="/preview"
              className="rounded px-3 py-1 text-xs font-medium bg-deloitte/20 text-deloitte-light hover:bg-deloitte/30 transition-colors"
            >
              Review
            </Link>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Active Workstreams"
          value={`${summary?.activeWorkstreams ?? 0} / ${summary?.totalWorkstreams ?? 0}`}
          color="blue"
        />
        <SummaryCard
          label="Emails Sent (7d)"
          value={String(summary?.emailsSentThisWeek ?? 0)}
          color="green"
        />
        <SummaryCard
          label="Pending Approval"
          value={String(summary?.pendingApprovalCount ?? 0)}
          color={summary?.pendingApprovalCount ? "amber" : "slate"}
          href={summary?.pendingApprovalCount ? "/preview" : undefined}
        />
        <SummaryCard
          label="Escalations"
          value={String(summary?.escalationCount ?? 0)}
          color={summary?.escalationCount ? "red" : "slate"}
        />
      </div>

      {/* Escalation Alerts */}
      {escalations.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="h-5 w-5 text-red-400"
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
            <h3 className="text-sm font-medium text-red-300">
              {escalations.length} investment
              {escalations.length !== 1 ? "s" : ""} need escalation
            </h3>
          </div>
          <div className="space-y-2">
            {escalations.map((esc) => (
              <div
                key={esc.id}
                className="flex items-center justify-between rounded-md bg-slate-900/50 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">
                    {esc.accountName} &mdash; {esc.investmentName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {esc.investmentId} &middot; Emailed {esc.sendCount}x &middot;
                    Last:{" "}
                    {new Date(esc.lastEmailedAt).toLocaleDateString()} &middot;
                    Status: {esc.currentStatus}
                  </p>
                </div>
                <button
                  onClick={() => handleResolveEscalation(esc.id)}
                  className="ml-3 rounded px-2 py-1 text-xs font-medium text-red-300 bg-red-500/20 hover:bg-red-500/30 transition-colors whitespace-nowrap"
                >
                  Mark Reviewed
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched Industries Alert */}
      {unmatched.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-900/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
              <p className="text-sm text-amber-300">
                <span className="font-medium">{unmatched.length}</span>{" "}
                investment{unmatched.length !== 1 ? "s have" : " has"} unmapped
                industries
              </p>
            </div>
            <Link
              href="/contacts"
              className="rounded px-3 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Fix Mappings
            </Link>
          </div>
        </div>
      )}

      {/* Workstream Cards */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-3">
          Workstreams
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.workstreamCards.map((ws) => (
            <div
              key={ws.id}
              className={`rounded-lg border p-4 ${
                ws.enabled
                  ? "bg-slate-900 border-slate-700"
                  : "bg-slate-900/50 border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">
                    {ws.name}
                  </h3>
                  {ws.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ws.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleToggleWorkstream(ws)}
                  disabled={togglingWorkstream === ws.id}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    ws.enabled ? "bg-deloitte" : "bg-slate-600"
                  } ${togglingWorkstream === ws.id ? "opacity-50" : ""}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                      ws.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                <div>
                  <span className="text-slate-500">Cadence:</span>{" "}
                  <span className="text-slate-300 capitalize">{ws.cadence}</span>
                </div>
                <div>
                  <span className="text-slate-500">Template:</span>{" "}
                  <span className="text-slate-300">{ws.templateName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Last run:</span>{" "}
                  <span className="text-slate-300">
                    {ws.lastRunAt
                      ? new Date(ws.lastRunAt).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Next run:</span>{" "}
                  <span className="text-slate-300">
                    {ws.nextRunAt
                      ? new Date(ws.nextRunAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>

              {ws.lastBatch && (
                <div className="flex items-center gap-3 text-xs mb-3 px-2 py-1.5 rounded bg-slate-800/50">
                  <span className="text-slate-500">Last batch:</span>
                  <span className="text-green-400">
                    {ws.lastBatch.sentCount} sent
                  </span>
                  {ws.lastBatch.failedCount > 0 && (
                    <span className="text-red-400">
                      {ws.lastBatch.failedCount} failed
                    </span>
                  )}
                  <span
                    className={`ml-auto rounded px-1.5 py-0.5 text-xs ${
                      ws.lastBatch.status === "completed"
                        ? "bg-green-900/30 text-green-400"
                        : ws.lastBatch.status === "pending_approval"
                          ? "bg-amber-900/30 text-amber-400"
                          : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {ws.lastBatch.status.replace("_", " ")}
                  </span>
                </div>
              )}

              <button
                onClick={() => handleRunWorkstream(ws)}
                disabled={runningWorkstream === ws.id || !ws.enabled}
                className="w-full rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {runningWorkstream === ws.id ? "Running..." : "Run Now"}
              </button>
            </div>
          ))}
          {data?.workstreamCards.length === 0 && (
            <p className="text-sm text-slate-500 col-span-2">
              No workstreams configured.{" "}
              <Link href="/workstreams" className="text-deloitte hover:underline">
                Create one
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-3">
          Recent Activity
        </h2>
        <div className="rounded-lg bg-slate-900 border border-slate-700">
          {data?.recentActivity.length === 0 ? (
            <p className="p-4 text-sm text-slate-500 text-center">
              No recent email activity.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {data?.recentActivity.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() =>
                      setExpandedActivity(
                        expandedActivity === item.id ? null : item.id
                      )
                    }
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <span
                      className={`flex-shrink-0 h-2 w-2 rounded-full ${
                        item.result === "sent"
                          ? "bg-green-400"
                          : item.result === "failed"
                            ? "bg-red-400"
                            : item.result === "skipped"
                              ? "bg-slate-400"
                              : "bg-amber-400"
                      }`}
                    />
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">
                      {new Date(item.sentAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-xs text-deloitte w-32 flex-shrink-0 truncate">
                      {item.workstreamName}
                    </span>
                    <span className="text-sm text-slate-300 flex-1 truncate">
                      {item.accountName}
                    </span>
                    <span className="text-xs text-slate-500 truncate max-w-[200px]">
                      {item.toEmail}
                    </span>
                    {item.isTest && (
                      <span className="rounded px-1.5 py-0.5 text-xs bg-purple-900/30 text-purple-400">
                        TEST
                      </span>
                    )}
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        item.result === "sent"
                          ? "bg-green-900/30 text-green-400"
                          : item.result === "failed"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {item.result}
                    </span>
                  </button>
                  {expandedActivity === item.id && (
                    <div className="px-4 pb-3 text-xs space-y-1 bg-slate-800/30">
                      <p>
                        <span className="text-slate-500">Subject:</span>{" "}
                        <span className="text-slate-300">{item.subject}</span>
                      </p>
                      <p>
                        <span className="text-slate-500">Investment:</span>{" "}
                        <span className="text-slate-300">
                          {item.investmentName}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-500">To:</span>{" "}
                        <span className="text-slate-300">
                          {item.toName ? `${item.toName} <${item.toEmail}>` : item.toEmail}
                        </span>
                      </p>
                      {item.errorMessage && (
                        <p>
                          <span className="text-red-500">Error:</span>{" "}
                          <span className="text-red-300">
                            {item.errorMessage}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: string;
  color: "blue" | "green" | "amber" | "red" | "slate";
  href?: string;
}) {
  const colorMap = {
    blue: "border-deloitte/20 text-deloitte",
    green: "border-green-500/20 text-green-400",
    amber: "border-amber-500/20 text-amber-400",
    red: "border-red-500/20 text-red-400",
    slate: "border-slate-700 text-slate-300",
  };

  const content = (
    <div
      className={`rounded-lg bg-slate-900 border p-4 ${colorMap[color]} ${href ? "hover:bg-slate-800/50 cursor-pointer transition-colors" : ""}`}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
