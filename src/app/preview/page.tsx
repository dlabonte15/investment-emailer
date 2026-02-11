"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import PageHeader from "@/components/PageHeader";

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
  sentAt: string;
}

interface Batch {
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
  startedAt: string;
  completedAt: string | null;
  emails: BatchEmail[];
}

interface BatchSummary {
  id: number;
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
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  sent: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  skipped: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  skipped_dedupe: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const batchStatusColors: Record<string, string> = {
  pending_approval: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sending: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function PreviewPage() {
  const { data: session } = useSession();
  const [pendingBatches, setPendingBatches] = useState<BatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
  const [reIncludedDedupe, setReIncludedDedupe] = useState<Set<number>>(new Set());
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchPendingBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/batches?status=pending_approval&limit=50");
      if (!res.ok) throw new Error("Failed to fetch batches");
      const data = await res.json();
      setPendingBatches(data.batches);
    } catch (error) {
      toast.error("Failed to load pending batches");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingBatches();
  }, [fetchPendingBatches]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expandedEmail !== null) {
          setExpandedEmail(null);
        } else if (selectedBatch) {
          setSelectedBatch(null);
        }
      }
      if (e.ctrlKey && e.key === "Enter" && selectedBatch && !sending) {
        e.preventDefault();
        handleApproveAndSend();
      }
      if (e.ctrlKey && e.key === "t" && selectedBatch && !sending) {
        e.preventDefault();
        handleTestSend();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch, sending, expandedEmail]);

  const loadBatchDetail = async (batchId: number) => {
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (!res.ok) throw new Error("Failed to load batch");
      const data: Batch = await res.json();
      setSelectedBatch(data);
      // Select all pending (non-dedupe) emails by default
      const pending = new Set(
        data.emails.filter((e) => e.result === "pending").map((e) => e.id)
      );
      setSelectedEmails(pending);
      setReIncludedDedupe(new Set());
    } catch (error) {
      toast.error("Failed to load batch details");
      console.error(error);
    }
  };

  const handleApproveAndSend = async () => {
    if (!selectedBatch || sending) return;

    // Pending emails that are NOT selected → excluded
    const allPendingIds = selectedBatch.emails
      .filter((e) => e.result === "pending")
      .map((e) => e.id);
    const excludedIds = allPendingIds.filter((id) => !selectedEmails.has(id));

    // Dedupe emails that WERE re-included
    const reIncludeIds = Array.from(reIncludedDedupe);

    setSending(true);
    try {
      const res = await fetch(`/api/batches/${selectedBatch.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludedEmailIds: excludedIds,
          reIncludedEmailIds: reIncludeIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      toast.success(
        `Batch sent: ${data.sentCount} sent, ${data.failedCount} failed`
      );
      setSelectedBatch(null);
      fetchPendingBatches();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve batch"
      );
    } finally {
      setSending(false);
    }
  };

  const handleTestSend = async () => {
    if (!selectedBatch || sending) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/batches/${selectedBatch.id}/test-send`,
        { method: "POST" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to test send");

      toast.success(
        `Test sent to ${data.testEmail}: ${data.sentCount} sent, ${data.failedCount} failed`
      );
      setSelectedBatch(null);
      fetchPendingBatches();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to test send"
      );
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedBatch || sending) return;

    if (!confirm("Are you sure you want to cancel this batch? All pending emails will be discarded.")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/batches/${selectedBatch.id}/cancel`,
        { method: "POST" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");

      toast.success("Batch cancelled");
      setSelectedBatch(null);
      fetchPendingBatches();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel batch"
      );
    }
  };

  const toggleEmail = (id: number) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDedupeReInclude = (id: number) => {
    setReIncludedDedupe((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!selectedBatch) return;
    setSelectedEmails(
      new Set(
        selectedBatch.emails
          .filter((e) => e.result === "pending")
          .map((e) => e.id)
      )
    );
  };

  const deselectAll = () => setSelectedEmails(new Set());

  const getWarnings = (email: BatchEmail): string[] => {
    const warnings: string[] = [];
    if (!email.toEmail || !email.toEmail.includes("@")) {
      warnings.push("Missing recipient email");
    }
    if (!email.ccEmails) {
      warnings.push("No CC recipients");
    }
    if (email.body.includes("{{") && email.body.includes("}}")) {
      warnings.push("Unresolved template placeholders");
    }
    if (email.result === "skipped_dedupe") {
      warnings.push("Duplicate: already emailed within dedupe window");
    }
    return warnings;
  };

  // ─── Batch List View ───────────────────────────────────────────────

  if (!selectedBatch) {
    return (
      <div>
        <PageHeader
          title="Preview & Approve"
          description="Review and approve queued emails before sending"
        />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-lg bg-slate-900 border border-slate-700 animate-pulse"
              />
            ))}
          </div>
        ) : pendingBatches.length === 0 ? (
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-slate-600 mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-slate-400 text-lg">No pending batches</p>
            <p className="text-slate-500 text-sm mt-1">
              Run a workstream to generate emails for review
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingBatches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => loadBatchDetail(batch.id)}
                className="w-full text-left rounded-lg bg-slate-900 border border-slate-700 p-4 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        batchStatusColors[batch.status] ||
                        "bg-slate-500/20 text-slate-400"
                      }`}
                    >
                      {batch.status.replace("_", " ")}
                    </span>
                    <div>
                      <p className="font-medium text-slate-200">
                        {batch.workstreamName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Triggered by {batch.triggeredBy} &middot;{" "}
                        {new Date(batch.startedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-400">
                      {batch.emailCount} email{batch.emailCount !== 1 ? "s" : ""}
                    </span>
                    {batch.skippedCount > 0 && (
                      <span className="text-orange-400 text-xs">
                        {batch.skippedCount} dedupe
                      </span>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Batch Detail / Email Queue View ───────────────────────────────

  const pendingEmails = selectedBatch.emails.filter(
    (e) => e.result === "pending"
  );
  const dedupeEmails = selectedBatch.emails.filter(
    (e) => e.result === "skipped_dedupe"
  );
  const selectedCount = selectedEmails.size;
  const reIncludeCount = reIncludedDedupe.size;
  const totalToSend = selectedCount + reIncludeCount;

  return (
    <div>
      <PageHeader
        title="Preview & Approve"
        description={`Reviewing: ${selectedBatch.workstreamName}`}
        actions={
          <button
            onClick={() => setSelectedBatch(null)}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md hover:bg-slate-800"
          >
            Back to Queue
          </button>
        }
      />

      {/* Batch Summary Bar */}
      <div className="rounded-lg bg-slate-900 border border-slate-700 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-slate-500">Workstream:</span>{" "}
              <span className="text-slate-200">
                {selectedBatch.workstreamName}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Triggered by:</span>{" "}
              <span className="text-slate-200">
                {selectedBatch.triggeredBy}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Pending:</span>{" "}
              <span className="text-slate-200">
                {pendingEmails.length}
              </span>
            </div>
            {dedupeEmails.length > 0 && (
              <div>
                <span className="text-slate-500">Duplicates:</span>{" "}
                <span className="text-orange-400">
                  {dedupeEmails.length}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Will send:</span>{" "}
              <span className="text-blue-400">{totalToSend}</span>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              batchStatusColors[selectedBatch.status] ||
              "bg-slate-500/20 text-slate-400"
            }`}
          >
            {selectedBatch.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md hover:bg-slate-800"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md hover:bg-slate-800"
          >
            Deselect All
          </button>
          <span className="text-xs text-slate-500 ml-2">
            {selectedCount} of {pendingEmails.length} selected
            {reIncludeCount > 0 && (
              <span className="text-orange-400">
                {" "}+ {reIncludeCount} re-included
              </span>
            )}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            disabled={sending}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 border border-slate-700 rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel Batch
          </button>
          <button
            onClick={handleTestSend}
            disabled={sending}
            className="px-3 py-1.5 text-sm text-amber-400 border border-amber-500/30 rounded-md hover:bg-amber-500/10 disabled:opacity-50"
            title="Ctrl+T"
          >
            {sending ? "Sending..." : "Send to Me Only"}
          </button>
          <button
            onClick={handleApproveAndSend}
            disabled={sending || totalToSend === 0}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Ctrl+Enter"
          >
            {sending
              ? "Sending..."
              : `Approve & Send (${totalToSend})`}
          </button>
        </div>
      </div>

      {/* Email Queue Table — Pending emails */}
      <div className="rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="px-3 py-2.5 text-left w-10">
                <input
                  type="checkbox"
                  checked={
                    pendingEmails.length > 0 &&
                    selectedCount === pendingEmails.length
                  }
                  onChange={(e) =>
                    e.target.checked ? selectAll() : deselectAll()
                  }
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                Recipient
              </th>
              <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                CC
              </th>
              <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                Subject
              </th>
              <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                Account
              </th>
              <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-slate-400 font-medium w-10">
                Warnings
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {selectedBatch.emails
              .filter((e) => e.result === "pending")
              .map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  isSelected={selectedEmails.has(email.id)}
                  isExpanded={expandedEmail === email.id}
                  isDedupe={false}
                  isReIncluded={false}
                  warnings={getWarnings(email)}
                  onToggleSelect={() => toggleEmail(email.id)}
                  onToggleExpand={() =>
                    setExpandedEmail(
                      expandedEmail === email.id ? null : email.id
                    )
                  }
                  onToggleReInclude={() => {}}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* Deduplicated Emails Section */}
      {dedupeEmails.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-orange-400">
              Skipped — Duplicates ({dedupeEmails.length})
            </h3>
            <p className="text-xs text-slate-500">
              These recipients were already emailed within the dedupe window. Check to re-include.
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 border border-orange-500/20 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {dedupeEmails.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    isSelected={false}
                    isExpanded={expandedEmail === email.id}
                    isDedupe={true}
                    isReIncluded={reIncludedDedupe.has(email.id)}
                    warnings={getWarnings(email)}
                    onToggleSelect={() => {}}
                    onToggleExpand={() =>
                      setExpandedEmail(
                        expandedEmail === email.id ? null : email.id
                      )
                    }
                    onToggleReInclude={() => toggleDedupeReInclude(email.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Footer */}
      <div className="mt-3 flex items-center justify-end gap-4 text-xs text-slate-600">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
            Ctrl+Enter
          </kbd>{" "}
          Approve & Send
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
            Ctrl+T
          </kbd>{" "}
          Test Send
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
            Esc
          </kbd>{" "}
          Back / Close
        </span>
      </div>
    </div>
  );
}

// ─── Reusable Email Row Component ────────────────────────────────────

function EmailRow({
  email,
  isSelected,
  isExpanded,
  isDedupe,
  isReIncluded,
  warnings,
  onToggleSelect,
  onToggleExpand,
  onToggleReInclude,
}: {
  email: BatchEmail;
  isSelected: boolean;
  isExpanded: boolean;
  isDedupe: boolean;
  isReIncluded: boolean;
  warnings: string[];
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleReInclude: () => void;
}) {
  const rowOpacity = isDedupe && !isReIncluded ? "opacity-60" : "";

  return (
    <tr className="group">
      <td className="px-3 py-2.5" colSpan={7}>
        <div className={rowOpacity}>
          {/* Email Row */}
          <div className="flex items-center">
            <div className="w-10 flex-shrink-0">
              {isDedupe ? (
                <input
                  type="checkbox"
                  checked={isReIncluded}
                  onChange={onToggleReInclude}
                  className="rounded border-orange-500/50 bg-slate-800 text-orange-500 focus:ring-orange-500/30"
                  title="Re-include this duplicate"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelect}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30"
                />
              )}
            </div>
            <button
              onClick={onToggleExpand}
              className="flex-1 flex items-center text-left hover:bg-slate-800/30 -mx-1 px-1 rounded"
            >
              <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_1.5fr_1fr_auto_auto] gap-3 items-center">
                <div className="truncate">
                  <p className={`truncate ${isDedupe && !isReIncluded ? "text-slate-500 line-through" : "text-slate-200"}`}>
                    {email.toName || email.toEmail}
                  </p>
                  {email.toName && (
                    <p className="text-xs text-slate-500 truncate">
                      {email.toEmail}
                    </p>
                  )}
                </div>
                <p className="text-slate-500 text-xs truncate">
                  {email.ccEmails || "\u2014"}
                </p>
                <p className={`truncate ${isDedupe && !isReIncluded ? "text-slate-500" : "text-slate-300"}`}>
                  {email.subject}
                </p>
                <p className="text-slate-400 truncate">
                  {email.accountName}
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    isReIncluded
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : statusColors[email.result] ||
                        "bg-slate-500/20 text-slate-400"
                  }`}
                >
                  {isReIncluded ? "re-included" : email.result === "skipped_dedupe" ? "duplicate" : email.result}
                </span>
                <div className="w-8 flex justify-center">
                  {warnings.length > 0 && (
                    <span
                      className={isDedupe ? "text-orange-400" : "text-amber-400"}
                      title={warnings.join("; ")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ml-2 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Expanded Email Body */}
          {isExpanded && (
            <div className={`mt-3 ml-10 rounded-lg border overflow-hidden ${isDedupe ? "border-orange-500/20 bg-slate-800/30" : "border-slate-700 bg-slate-800/50"}`}>
              {/* Warnings */}
              {warnings.length > 0 && (
                <div className={`px-4 py-2 border-b ${isDedupe ? "bg-orange-500/10 border-orange-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
                  {warnings.map((w, i) => (
                    <p
                      key={i}
                      className={`text-xs ${isDedupe ? "text-orange-400" : "text-amber-400"}`}
                    >
                      Warning: {w}
                    </p>
                  ))}
                  {isDedupe && !isReIncluded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleReInclude();
                      }}
                      className="mt-1 px-2 py-0.5 text-xs font-medium text-orange-300 border border-orange-500/30 rounded hover:bg-orange-500/10"
                    >
                      Override: Re-include this email
                    </button>
                  )}
                </div>
              )}

              {/* Error Message */}
              {email.errorMessage && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                  <p className="text-xs text-red-400">
                    Error: {email.errorMessage}
                  </p>
                </div>
              )}

              {/* Email Metadata */}
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
                    <span className="text-slate-500">CC: </span>
                    <span className="text-slate-300">
                      {email.ccEmails}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Subject: </span>
                  <span className="text-slate-200 font-medium">
                    {email.subject}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Investment: </span>
                  <span className="text-slate-300">
                    {email.investmentId} &middot;{" "}
                    {email.investmentName}
                  </span>
                </div>
              </div>

              {/* Email Body Preview */}
              <div className="px-4 py-3">
                <div
                  className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none"
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
}
