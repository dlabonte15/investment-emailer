"use client";

import { useCallback, useEffect, useState } from "react";
import { showError } from "@/components/ToastProvider";

interface AuditEntry {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

const ENTITY_TYPES = [
  "GlobalSettings",
  "ColumnMapping",
  "User",
  "EmailTemplate",
  "Workstream",
  "IndustryContact",
];

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (entityFilter) params.set("entityType", entityFilter);

      const res = await fetch(`/api/settings/audit-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch {
      showError("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [entityFilter, offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setOffset(0);
  }, [entityFilter]);

  return (
    <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-50">Audit Log</h2>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:border-deloitte focus:outline-none"
        >
          <option value="">All Types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-slate-800" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          No audit log entries found.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="border-b border-slate-800">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === log.id ? null : log.id)
                  }
                  className="w-full flex items-center gap-3 py-2 text-left text-sm hover:bg-slate-800/50 rounded px-2 transition-colors"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      log.action === "delete"
                        ? "bg-red-900/30 text-red-400"
                        : log.action === "create"
                          ? "bg-green-900/30 text-green-400"
                          : "bg-deloitte-dark/30 text-deloitte"
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="text-slate-400 text-xs">
                    {log.entityType}
                    {log.entityId && ` #${log.entityId}`}
                  </span>
                  <span className="text-slate-500 text-xs ml-auto">
                    {log.userId}
                  </span>
                  <span className="text-slate-600 text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                  <svg
                    className={`h-3 w-3 text-slate-500 transition-transform ${
                      expandedId === log.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {expandedId === log.id && (
                  <div className="px-2 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {log.oldValue && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Old Value:
                        </p>
                        <pre className="rounded bg-slate-800 p-2 text-xs text-slate-400 overflow-auto max-h-40">
                          {formatJson(log.oldValue)}
                        </pre>
                      </div>
                    )}
                    {log.newValue && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          New Value:
                        </p>
                        <pre className="rounded bg-slate-800 p-2 text-xs text-slate-400 overflow-auto max-h-40">
                          {formatJson(log.newValue)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of{" "}
                {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
