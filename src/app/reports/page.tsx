"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { showError } from "@/components/ToastProvider";

interface WeeklySummary {
  period: { from: string; to: string };
  totals: {
    sent: number;
    failed: number;
    successRate: number;
    batches: number;
    escalations: number;
  };
  byWorkstream: {
    workstreamId: number;
    workstreamName: string;
    sent: number;
    failed: number;
    skipped: number;
    total: number;
    successRate: number;
  }[];
  weeklyTrend: { weekStart: string; weekEnd: string; sent: number }[];
}

interface PerformanceData {
  performance: {
    workstreamId: number;
    workstreamName: string;
    enabled: boolean;
    totalBatches: number;
    totalEmails: number;
    weeklyData: {
      week: string;
      sent: number;
      failed: number;
      failureRate: number;
    }[];
  }[];
}

interface OpenTrackingData {
  enabled: boolean;
  message?: string;
  overall?: { totalSent: number; totalOpened: number; openRate: number };
  byWorkstream?: {
    workstreamId: number;
    workstreamName: string;
    sent: number;
    opened: number;
    openRate: number;
  }[];
  unopenedRecent?: {
    id: number;
    toEmail: string;
    toName: string | null;
    accountName: string;
    subject: string;
    sentAt: string;
    workstreamName: string;
  }[];
}

type Tab = "weekly" | "performance" | "tracking";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("weekly");
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [tracking, setTracking] = useState<OpenTrackingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "weekly") {
        const res = await fetch("/api/reports/weekly-summary");
        if (res.ok) setWeekly(await res.json());
      } else if (tab === "performance") {
        const res = await fetch("/api/reports/workstream-performance?weeks=8");
        if (res.ok) setPerf(await res.json());
      } else if (tab === "tracking") {
        const res = await fetch("/api/reports/open-tracking");
        if (res.ok) setTracking(await res.json());
      }
    } catch {
      showError("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "weekly", label: "Weekly Summary" },
    { key: "performance", label: "Workstream Performance" },
    { key: "tracking", label: "Open Tracking" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <PageHeader
          title="Reports"
          description="Weekly summaries, workstream performance, and open tracking"
        />
        <div className="flex gap-2">
          <a
            href="/api/reports/export?type=all&format=xlsx"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
          >
            Export Excel
          </a>
          <a
            href="/api/reports/export?type=all&format=pdf"
            className="rounded-md border border-blue-500 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors whitespace-nowrap"
          >
            Export PDF
          </a>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-32"
            />
          ))}
        </div>
      ) : (
        <>
          {tab === "weekly" && weekly && <WeeklySummaryView data={weekly} />}
          {tab === "performance" && perf && <PerformanceView data={perf} />}
          {tab === "tracking" && tracking && (
            <OpenTrackingView data={tracking} />
          )}
        </>
      )}
    </div>
  );
}

function WeeklySummaryView({ data }: { data: WeeklySummary }) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Emails Sent" value={data.totals.sent} color="green" />
        <StatCard label="Failed" value={data.totals.failed} color="red" />
        <StatCard
          label="Success Rate"
          value={`${data.totals.successRate}%`}
          color="blue"
        />
        <StatCard label="Batches" value={data.totals.batches} color="slate" />
        <StatCard
          label="Escalations"
          value={data.totals.escalations}
          color={data.totals.escalations > 0 ? "red" : "slate"}
        />
      </div>

      {/* Weekly trend bar chart */}
      <div className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <h3 className="text-sm font-medium text-slate-200 mb-4">
          Emails Sent (Last 4 Weeks)
        </h3>
        <div className="flex items-end gap-4 h-32">
          {data.weeklyTrend.map((week, i) => {
            const maxVal = Math.max(...data.weeklyTrend.map((w) => w.sent), 1);
            const height = (week.sent / maxVal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400">{week.sent}</span>
                <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                  <div
                    className="w-full max-w-12 rounded-t bg-blue-500/60"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(week.weekStart).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-workstream breakdown */}
      <div className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <h3 className="text-sm font-medium text-slate-200 mb-4">
          Emails by Workstream (This Week)
        </h3>
        {data.byWorkstream.length === 0 ? (
          <p className="text-sm text-slate-500">No workstream data.</p>
        ) : (
          <div className="space-y-3">
            {data.byWorkstream.map((ws) => (
              <div key={ws.workstreamId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300">
                    {ws.workstreamName}
                  </span>
                  <span className="text-xs text-slate-500">
                    {ws.sent} sent, {ws.failed} failed, {ws.skipped} skipped
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  {ws.total > 0 && (
                    <div className="h-full flex">
                      <div
                        className="bg-green-500 rounded-l"
                        style={{
                          width: `${(ws.sent / ws.total) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${(ws.failed / ws.total) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-slate-600 rounded-r"
                        style={{
                          width: `${(ws.skipped / ws.total) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceView({ data }: { data: PerformanceData }) {
  return (
    <div className="space-y-6">
      {data.performance.map((ws) => (
        <div
          key={ws.workstreamId}
          className="rounded-lg bg-slate-900 border border-slate-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                {ws.workstreamName}
              </h3>
              <p className="text-xs text-slate-500">
                {ws.totalBatches} batches, {ws.totalEmails} total emails
              </p>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                ws.enabled
                  ? "bg-green-900/30 text-green-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              {ws.enabled ? "Active" : "Disabled"}
            </span>
          </div>

          {/* Mini bar chart for weekly performance */}
          <div className="flex items-end gap-2 h-20">
            {ws.weeklyData.map((week, i) => {
              const maxVal = Math.max(
                ...ws.weeklyData.map((w) => w.sent + w.failed),
                1
              );
              const total = week.sent + week.failed;
              const height = (total / maxVal) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-0.5"
                >
                  <span className="text-xs text-slate-500">
                    {total > 0 ? total : ""}
                  </span>
                  <div className="w-full flex items-end justify-center" style={{ height: "48px" }}>
                    <div className="w-full max-w-8 flex flex-col justify-end rounded-t overflow-hidden" style={{ height: `${Math.max(height, 4)}%` }}>
                      {week.failed > 0 && total > 0 && (
                        <div
                          className="bg-red-500"
                          style={{
                            height: `${(week.failed / total) * 100}%`,
                          }}
                        />
                      )}
                      <div className="bg-blue-500/60 flex-1" />
                    </div>
                  </div>
                  <span className="text-xs text-slate-600">
                    {new Date(week.week).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {data.performance.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">
          No workstream data available.
        </p>
      )}
    </div>
  );
}

function OpenTrackingView({ data }: { data: OpenTrackingData }) {
  if (!data.enabled) {
    return (
      <div className="rounded-lg bg-slate-900 border border-slate-700 p-8 text-center">
        <p className="text-slate-400">{data.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Sent"
          value={data.overall?.totalSent ?? 0}
          color="blue"
        />
        <StatCard
          label="Opened"
          value={data.overall?.totalOpened ?? 0}
          color="green"
        />
        <StatCard
          label="Open Rate"
          value={`${data.overall?.openRate ?? 0}%`}
          color="emerald"
        />
      </div>

      {/* Open rate by workstream */}
      <div className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <h3 className="text-sm font-medium text-slate-200 mb-4">
          Open Rate by Workstream
        </h3>
        <div className="space-y-3">
          {data.byWorkstream?.map((ws) => (
            <div key={ws.workstreamId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-300">
                  {ws.workstreamName}
                </span>
                <span className="text-xs text-slate-500">
                  {ws.opened}/{ws.sent} opened ({ws.openRate}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${ws.openRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unopened emails */}
      {data.unopenedRecent && data.unopenedRecent.length > 0 && (
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-6">
          <h3 className="text-sm font-medium text-slate-200 mb-4">
            Unopened Follow-ups (Last 7 Days)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-4 text-xs text-slate-400 font-medium">
                    Recipient
                  </th>
                  <th className="text-left py-2 pr-4 text-xs text-slate-400 font-medium">
                    Account
                  </th>
                  <th className="text-left py-2 pr-4 text-xs text-slate-400 font-medium">
                    Subject
                  </th>
                  <th className="text-left py-2 pr-4 text-xs text-slate-400 font-medium">
                    Workstream
                  </th>
                  <th className="text-left py-2 text-xs text-slate-400 font-medium">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.unopenedRecent.map((email) => (
                  <tr key={email.id} className="border-b border-slate-800">
                    <td className="py-2 pr-4 text-slate-300">
                      {email.toName || email.toEmail}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {email.accountName}
                    </td>
                    <td className="py-2 pr-4 text-slate-400 truncate max-w-[200px]">
                      {email.subject}
                    </td>
                    <td className="py-2 pr-4 text-blue-400 text-xs">
                      {email.workstreamName}
                    </td>
                    <td className="py-2 text-slate-500 text-xs">
                      {new Date(email.sentAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "blue" | "green" | "red" | "amber" | "slate" | "emerald";
}) {
  const colorMap = {
    blue: "text-blue-400",
    green: "text-green-400",
    red: "text-red-400",
    amber: "text-amber-400",
    slate: "text-slate-300",
    emerald: "text-emerald-400",
  };
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${colorMap[color]}`}>
        {value}
      </p>
    </div>
  );
}
