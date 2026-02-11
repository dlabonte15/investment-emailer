"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import PageHeader from "@/components/PageHeader";

// ─── Types ───────────────────────────────────────────────────────────

interface InvestmentSummary {
  investmentId: string;
  accountName: string;
  investmentName: string;
  investmentStatus: string;
  jupiterStage: string;
  primaryIndustry: string;
  requestedAmount: string | number | null;
  approvedAmount: string | number | null;
  investmentLeader: string;
  totalEmailsSent: number;
  lastEmailed: string | null;
  escalationFlag: boolean;
  escalationSendCount: number;
}

interface EmailTimelineItem {
  id: number;
  workstreamName: string;
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

interface InvestmentNote {
  id: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

interface InvestmentDetail {
  investmentId: string;
  fields: Record<string, string | number | null>;
  emailTimeline: EmailTimelineItem[];
  escalation: {
    id: number;
    sendCount: number;
    currentStatus: string;
    firstEmailedAt: string;
    lastEmailedAt: string;
    resolved: boolean;
  } | null;
  notes: InvestmentNote[];
}

// ─── Status color helpers ────────────────────────────────────────────

const investmentStatusColors: Record<string, string> = {
  earmarked: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  funded: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  abandoned: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const jupiterStageColors: Record<string, string> = {
  "closed won": "bg-emerald-500/20 text-emerald-400",
  "verbal commit": "bg-emerald-500/20 text-emerald-400",
  "closed lost": "bg-red-500/20 text-red-400",
  "closed abandoned": "bg-slate-500/20 text-slate-400",
};

const emailResultColors: Record<string, string> = {
  sent: "text-emerald-400",
  failed: "text-red-400",
  skipped: "text-slate-500",
  pending: "text-yellow-400",
};

function getStatusColor(status: string): string {
  return (
    investmentStatusColors[status.toLowerCase()] ||
    "bg-slate-500/20 text-slate-400 border-slate-500/30"
  );
}

// ─── Field display labels ────────────────────────────────────────────

const fieldLabels: Record<string, string> = {
  investment_id: "Investment ID",
  investment_status: "Status",
  account_name: "Account",
  investment_name: "Investment Name",
  investment_description: "Description",
  requested_amount: "Requested Amount",
  requested_date: "Requested Date",
  primary_industry: "Primary Industry",
  primary_op: "Primary OP",
  budget_owner: "Budget Owner",
  investment_category: "Category",
  fiscal_year: "Fiscal Year",
  notes: "Notes",
  granted_period: "Granted Period",
  jupiter_id: "Jupiter ID",
  jupiter_stage: "Jupiter Stage",
  approved_soft_dollar: "Approved Soft Dollar",
  approved_amount: "Approved Amount",
  decision_date: "Decision Date",
  investment_leader: "Investment Leader",
  investment_leader_email: "Investment Leader Email",
  requestor_email: "Requestor Email",
  follow_on_jupiter_ids: "Follow-on Jupiter IDs",
  wbs_code: "WBS Code",
  deal_prioritization: "Deal Prioritization",
  soft_dollar_allocation: "Soft Dollar Allocation",
  project_type: "Project Type",
  funding_spent: "Funding Spent",
};

// ─── Component ───────────────────────────────────────────────────────

export default function InvestmentsPage() {
  // List state
  const [investments, setInvestments] = useState<InvestmentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [sortField, setSortField] = useState("investment_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);

  // Detail state
  const [detail, setDetail] = useState<InvestmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        sortField,
        sortDir,
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (industryFilter) params.set("industry", industryFilter);
      if (escalatedOnly) params.set("escalated", "true");

      const res = await fetch(`/api/investments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInvestments(data.investments);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.filters) {
        setAvailableStatuses(data.filters.statuses);
        setAvailableIndustries(data.filters.industries);
      }
    } catch (error) {
      toast.error("Failed to load investments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, industryFilter, escalatedOnly, sortField, sortDir]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const loadDetail = async (investmentId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/investments/${encodeURIComponent(investmentId)}`
      );
      if (!res.ok) throw new Error("Failed to load");
      const data: InvestmentDetail = await res.json();
      setDetail(data);
      setExpandedEmail(null);
      setNewNote("");
    } catch (error) {
      toast.error("Failed to load investment details");
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!detail || !newNote.trim() || addingNote) return;

    setAddingNote(true);
    try {
      const res = await fetch(
        `/api/investments/${encodeURIComponent(detail.investmentId)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: newNote.trim() }),
        }
      );
      if (!res.ok) throw new Error("Failed to add note");
      const note: InvestmentNote = await res.json();
      setDetail((prev) =>
        prev ? { ...prev, notes: [note, ...prev.notes] } : prev
      );
      setNewNote("");
      toast.success("Note added");
    } catch (error) {
      toast.error("Failed to add note");
      console.error(error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 inline ml-1 ${sortDir === "desc" ? "rotate-180" : ""}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
      </svg>
    );
  };

  // ─── Detail View ───────────────────────────────────────────────────

  if (detail) {
    const f = detail.fields;
    return (
      <div>
        <PageHeader
          title={String(f.investment_name || detail.investmentId)}
          description={`${String(f.account_name || "")} — ${detail.investmentId}`}
          actions={
            <div className="flex items-center gap-2">
              {detail.escalation && !detail.escalation.resolved && (
                <span className="px-2.5 py-1 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                  Needs Escalation ({detail.escalation.sendCount}x emailed)
                </span>
              )}
              <button
                onClick={() => setDetail(null)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md hover:bg-slate-800"
              >
                Back to List
              </button>
            </div>
          }
        />

        {/* Investment Data Fields */}
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-4 mb-4">
          <h2 className="text-sm font-medium text-slate-300 mb-3">
            Investment Details
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {Object.entries(f).map(([key, value]) => {
              if (value === null || value === undefined || value === "") return null;
              return (
                <div key={key} className="py-1">
                  <dt className="text-xs text-slate-500">
                    {fieldLabels[key] || key}
                  </dt>
                  <dd className="text-sm text-slate-200 break-words">
                    {key === "investment_status" ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(String(value))}`}
                      >
                        {String(value)}
                      </span>
                    ) : (
                      String(value)
                    )}
                  </dd>
                </div>
              );
            })}
          </div>
        </div>

        {/* Email Timeline */}
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-4 mb-4">
          <h2 className="text-sm font-medium text-slate-300 mb-3">
            Email Timeline ({detail.emailTimeline.length})
          </h2>

          {detail.emailTimeline.length === 0 ? (
            <p className="text-sm text-slate-500">
              No emails have been sent for this investment.
            </p>
          ) : (
            <div className="space-y-1">
              {detail.emailTimeline.map((email) => {
                const isExpanded = expandedEmail === email.id;
                return (
                  <div key={email.id}>
                    <button
                      onClick={() =>
                        setExpandedEmail(isExpanded ? null : email.id)
                      }
                      className="w-full flex items-center gap-3 py-2 px-2 text-left rounded-md hover:bg-slate-800/50 text-sm"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          email.result === "sent"
                            ? "bg-emerald-400"
                            : email.result === "failed"
                            ? "bg-red-400"
                            : "bg-slate-500"
                        }`}
                      />
                      <span className="text-xs text-slate-500 w-36 flex-shrink-0 whitespace-nowrap">
                        {new Date(email.sentAt).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 w-32 flex-shrink-0 truncate">
                        {email.workstreamName}
                      </span>
                      <span className="text-slate-300 truncate flex-1">
                        {email.subject}
                      </span>
                      <span className={`text-xs flex-shrink-0 ${emailResultColors[email.result] || ""}`}>
                        {email.result}
                        {email.isTest ? " (test)" : ""}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="ml-5 mt-1 mb-2 rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
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
                              <span className="text-slate-500">CC: </span>
                              <span className="text-slate-300">
                                {email.ccEmails}
                              </span>
                            </div>
                          )}
                          {email.openedAt && (
                            <div>
                              <span className="text-slate-500">Opened: </span>
                              <span className="text-emerald-400">
                                {new Date(email.openedAt).toLocaleString()} (
                                {email.openCount}x)
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
                );
              })}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-3">
            Notes ({detail.notes.length})
          </h2>

          {/* Add note form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Add a note about this investment..."
              className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || addingNote}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingNote ? "Adding..." : "Add Note"}
            </button>
          </div>

          {/* Notes list */}
          {detail.notes.length === 0 ? (
            <p className="text-sm text-slate-500">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.notes.map((note) => (
                <div
                  key={note.id}
                  className="px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700/50"
                >
                  <p className="text-sm text-slate-300">{note.note}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {note.createdBy} &middot;{" "}
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── List View ─────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Investment Activity"
        description="Per-investment email history and escalation tracking"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by ID, account, name, or leader..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 min-w-[240px] px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
        >
          <option value="">All statuses</option>
          {availableStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={industryFilter}
          onChange={(e) => {
            setIndustryFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
        >
          <option value="">All industries</option>
          {availableIndustries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={escalatedOnly}
            onChange={(e) => {
              setEscalatedOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/30"
          />
          Escalated only
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-slate-900 border border-slate-700 animate-pulse"
            />
          ))}
        </div>
      ) : investments.length === 0 ? (
        <div className="rounded-lg bg-slate-900 border border-slate-700 p-12 text-center">
          <p className="text-slate-400 text-lg">No investments found</p>
          <p className="text-slate-500 text-sm mt-1">
            {search || statusFilter || industryFilter || escalatedOnly
              ? "Try adjusting your filters"
              : "Upload an Excel file to load investment data"}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    {[
                      { key: "investmentId", label: "Investment ID" },
                      { key: "accountName", label: "Account" },
                      { key: "investmentName", label: "Investment Name" },
                      { key: "investmentStatus", label: "Status" },
                      { key: "jupiterStage", label: "Jupiter Stage" },
                      { key: "totalEmailsSent", label: "Emails Sent" },
                      { key: "lastEmailed", label: "Last Emailed" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-3 py-2.5 text-left text-slate-400 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap select-none"
                      >
                        {col.label}
                        <SortIcon field={col.key} />
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center text-slate-400 font-medium w-10">
                      Flag
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {investments.map((inv) => (
                    <tr
                      key={inv.investmentId}
                      onClick={() => loadDetail(inv.investmentId)}
                      className="hover:bg-slate-800/30 cursor-pointer"
                    >
                      <td className="px-3 py-2.5 text-blue-400 font-mono text-xs whitespace-nowrap">
                        {inv.investmentId}
                      </td>
                      <td className="px-3 py-2.5 text-slate-200 max-w-[160px] truncate">
                        {inv.accountName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 max-w-[200px] truncate">
                        {inv.investmentName}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(inv.investmentStatus)}`}
                        >
                          {inv.investmentStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {inv.jupiterStage ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              jupiterStageColors[inv.jupiterStage.toLowerCase()] ||
                              "bg-slate-500/20 text-slate-400"
                            }`}
                          >
                            {inv.jupiterStage}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300">
                        {inv.totalEmailsSent || (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                        {inv.lastEmailed
                          ? new Date(inv.lastEmailed).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {inv.escalationFlag && (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold"
                            title={`Escalated: emailed ${inv.escalationSendCount}x with no status change`}
                          >
                            !
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * 25 + 1}–
                {Math.min(page * 25, total)} of {total} investments
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from(
                  { length: Math.min(totalPages, 7) },
                  (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = page - 3 + i;
                    }
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
                  }
                )}
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
