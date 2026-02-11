"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import PageHeader from "@/components/PageHeader";

interface BatchSummary {
  id: number;
  workstreamId: number;
  workstreamName: string;
  triggeredBy: string;
  triggerType: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  emailCount: number;
  startedAt: string;
  completedAt: string | null;
}

interface BatchEmail {
  id: number;
  investmentId: string;
  accountName: string;
  investmentName: string;
  investmentStatus: string;
  toEmail: string;
  toName: string | null;
  ccEmails: string | null;
  subject: string;
  body: string;
  result: string;
  errorMessage: string | null;
  isTest: boolean;
  openedAt: string | null;
  openCount: number;
  sentAt: string;
}

interface BatchDetail {
  id: number;
  workstreamName: string;
  triggeredBy: string;
  triggerType: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt: string | null;
  emails: BatchEmail[];
}

const statusColors: Record<string, string> = {
  pending_approval: "bg-amber-500/20 text-amber-400",
  approved: "bg-blue-500/20 text-blue-400",
  sending: "bg-purple-500/20 text-purple-400",
  completed: "bg-emerald-500/20 text-emerald-400",
};

const emailResultColors: Record<string, string> = {
  sent: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
  skipped: "bg-slate-500/20 text-slate-400",
  pending: "bg-yellow-500/20 text-yellow-400",
};

export default function HistoryPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (filterStatus) params.set("status", filterStatus);
      if (filterSearch) params.set("search", filterSearch);

      const res = await fetch(`/api/batches?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setBatches(data.batches);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      toast.error("Failed to load send history");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterSearch]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const loadBatchDetail = async (batchId: number) => {
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (!res.ok) throw new Error("Failed to load batch");
      const data: BatchDetail = await res.json();
      setSelectedBatch(data);
      setExpandedEmail(null);
    } catch (error) {
      toast.error("Failed to load batch details");
      console.error(error);
    }
  };

  const handleRetryFailed = async () => {
    if (!selectedBatch || retrying) return;

    setRetrying(true);
    try {
      const res = await fetch(
        `/api/batches/${selectedBatch.id}/retry`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry");

      toast.success(
        `Retry complete: ${data.sentCount} sent, ${data.failedCount} failed`
      );
      // Reload the batch detail
      await loadBatchDetail(selectedBatch.id);
      fetchBatches();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to retry"
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleExport = (format: "csv" | "xlsx" = "csv") => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    params.set("format", format);
    window.open(`/api/batches/export?${params}`, "_blank");
  };

  // ─── Batch Detail View ─────────────────────────────────────────────

  if (selectedBatch) {
    const sentEmails = selectedBatch.emails.filter((e) => e.result === "sent");
    const failedEmails = selectedBatch.emails.filter(
      (e) => e.result === "failed"
    );
    const skippedEmails = selectedBatch.emails.filter(
      (e) => e.result === "skipped"
    );

    return (
      <div>
        <PageHeader
          title="Batch Details"
          description={`${selectedBatch.workstreamName} — ${new Date(selectedBatch.startedAt).toLocaleString()}`}
          actions={
            <button
              onClick={() => setSelectedBatch(null)}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md hover:bg-slate-800"
            >
              Back to History
            </button>
          }
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-xl font-bold text-slate-200">
              {selectedBatch.totalCount}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 border border-emerald-500/20 p-3">
            <p className="text-xs text-emerald-400">Sent</p>
            <p className="text-xl font-bold text-emerald-400">
              {selectedBatch.sentCount}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 border border-red-500/20 p-3">
            <p className="text-xs text-red-400">Failed</p>
            <p className="text-xl font-bold text-red-400">
              {selectedBatch.failedCount}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-600 p-3">
            <p className="text-xs text-slate-500">Skipped</p>
            <p className="text-xl font-bold text-slate-400">
              {selectedBatch.skippedCount}
            </p>
          </div>
        </div>

        {/* Batch Info & Actions */}
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-slate-500">Triggered by:</span>{" "}
              <span className="text-slate-300">
                {selectedBatch.triggeredBy}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Type:</span>{" "}
              <span className="text-slate-300">
                {selectedBatch.triggerType}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Completed:</span>{" "}
              <span className="text-slate-300">
                {selectedBatch.completedAt
                  ? new Date(selectedBatch.completedAt).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>
          {failedEmails.length > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={retrying}
              className="px-3 py-1.5 text-sm text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/10 disabled:opacity-50"
            >
              {retrying
                ? "Retrying..."
                : `Retry Failed (${failedEmails.length})`}
            </button>
          )}
        </div>

        {/* Email Results Table */}
        <div className="rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                  Recipient
                </th>
                <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                  Account
                </th>
                <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                  Subject
                </th>
                <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                  Result
                </th>
                <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                  Sent At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {selectedBatch.emails.map((email) => {
                const isExpanded = expandedEmail === email.id;
                return (
                  <tr key={email.id}>
                    <td colSpan={5} className="px-3 py-0">
                      <div>
                        <button
                          onClick={() =>
                            setExpandedEmail(
                              isExpanded ? null : email.id
                            )
                          }
                          className="w-full flex items-center py-2.5 text-left hover:bg-slate-800/30 -mx-1 px-1 rounded"
                        >
                          <div className="flex-1 grid grid-cols-[1fr_1fr_1.5fr_auto_auto] gap-3 items-center">
                            <div className="truncate">
                              <p className="text-slate-200 truncate">
                                {email.toEmail}
                              </p>
                              {email.toName && (
                                <p className="text-xs text-slate-500">
                                  {email.toName}
                                </p>
                              )}
                            </div>
                            <p className="text-slate-400 truncate">
                              {email.accountName}
                            </p>
                            <p className="text-slate-300 truncate">
                              {email.subject}
                            </p>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                emailResultColors[email.result] || ""
                              }`}
                            >
                              {email.result === "sent" ? "Sent" : ""}
                              {email.result === "failed" ? "Failed" : ""}
                              {email.result === "skipped" ? "Skipped" : ""}
                              {email.result === "pending" ? "Pending" : ""}
                              {email.isTest ? " (Test)" : ""}
                            </span>
                            <p className="text-xs text-slate-500 whitespace-nowrap">
                              {new Date(email.sentAt).toLocaleString()}
                            </p>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ml-2 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="mb-3 rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                            {email.errorMessage && (
                              <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                                <p className="text-xs text-red-400">
                                  Error: {email.errorMessage}
                                </p>
                              </div>
                            )}
                            <div className="px-4 py-3 border-b border-slate-700 space-y-1 text-xs">
                              <div>
                                <span className="text-slate-500">To: </span>
                                <span className="text-slate-300">
                                  {email.toName
                                    ? `${email.toName} <${email.toEmail}>`
                                    : email.toEmail}
                                </span>
                              </div>
                              {email.ccEmails && (
                                <div>
                                  <span className="text-slate-500">
                                    CC:{" "}
                                  </span>
                                  <span className="text-slate-300">
                                    {email.ccEmails}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-slate-500">
                                  Subject:{" "}
                                </span>
                                <span className="text-slate-200 font-medium">
                                  {email.subject}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">
                                  Investment:{" "}
                                </span>
                                <span className="text-slate-300">
                                  {email.investmentId} &middot;{" "}
                                  {email.investmentName}
                                </span>
                              </div>
                              {email.openedAt && (
                                <div>
                                  <span className="text-slate-500">
                                    Opened:{" "}
                                  </span>
                                  <span className="text-emerald-400">
                                    {new Date(
                                      email.openedAt
                                    ).toLocaleString()}{" "}
                                    ({email.openCount} times)
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="px-4 py-3">
                              <div
                                className="text-sm text-slate-300 leading-relaxed"
                                style={{ whiteSpace: "pre-wrap" }}
                              >
                                {email.body}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Batch List View ───────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Send History"
        description="View all sent email batches and individual results"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("csv")}
              className="px-3 py-1.5 text-sm text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 hover:text-slate-200"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport("xlsx")}
              className="px-3 py-1.5 text-sm text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 hover:text-slate-200"
            >
              Export Excel
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by account, email, or investment ID..."
          value={filterSearch}
          onChange={(e) => {
            setFilterSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
        />
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="sending">Sending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Batch Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-slate-900 border border-slate-700 animate-pulse"
            />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-12 text-center">
          <p className="text-slate-400 text-lg">No send history yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Batches will appear here after running a workstream
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                    Date / Time
                  </th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                    Workstream
                  </th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                    Triggered By
                  </th>
                  <th className="px-3 py-2.5 text-center text-slate-400 font-medium">
                    Total
                  </th>
                  <th className="px-3 py-2.5 text-center text-slate-400 font-medium">
                    Sent
                  </th>
                  <th className="px-3 py-2.5 text-center text-slate-400 font-medium">
                    Failed
                  </th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {batches.map((batch) => (
                  <tr
                    key={batch.id}
                    onClick={() => loadBatchDetail(batch.id)}
                    className="hover:bg-slate-800/30 cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <p className="text-slate-300 whitespace-nowrap">
                        {new Date(batch.startedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(batch.startedAt).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-200">
                      {batch.workstreamName}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-slate-300 text-xs">
                        {batch.triggeredBy}
                      </p>
                      <p className="text-xs text-slate-500">
                        {batch.triggerType}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-300">
                      {batch.totalCount}
                    </td>
                    <td className="px-3 py-2.5 text-center text-emerald-400">
                      {batch.sentCount}
                    </td>
                    <td className="px-3 py-2.5 text-center text-red-400">
                      {batch.failedCount || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[batch.status] ||
                          "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {batch.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * 15 + 1}–
                {Math.min(page * 15, total)} of {total} batches
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-2.5 py-1 text-xs rounded-md border ${
                        page === pageNum
                          ? "bg-blue-600 text-white border-blue-500"
                          : "text-slate-400 border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
