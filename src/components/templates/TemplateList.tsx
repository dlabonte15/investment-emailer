"use client";

import { useCallback, useEffect, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";

interface Template {
  id: number;
  name: string;
  subject: string;
  isDefault: boolean;
  updatedAt: string;
  workstreams: { id: number; name: string }[];
}

export default function TemplateList({
  onSelect,
  onCreateNew,
  selectedId,
}: {
  onSelect: (id: number) => void;
  onCreateNew: () => void;
  selectedId: number | null;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch {
      showError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDuplicate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/templates/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const dup = await res.json();
      showSuccess(`Duplicated as "${dup.name}"`);
      fetchTemplates();
      onSelect(dup.id);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to duplicate");
    }
  };

  const handleDelete = async (template: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess("Template deleted");
      fetchTemplates();
      if (selectedId === template.id) onSelect(-1);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 h-24"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={onCreateNew}
        className="w-full rounded-lg border-2 border-dashed border-slate-600 p-4 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
      >
        + Create New Template
      </button>

      {templates.map((template) => (
        <div
          key={template.id}
          onClick={() => onSelect(template.id)}
          className={`
            cursor-pointer rounded-lg border p-4 transition-colors
            ${
              selectedId === template.id
                ? "border-blue-500 bg-blue-900/20"
                : "border-slate-700 bg-slate-900 hover:border-slate-600"
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-slate-200 truncate">
                {template.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500 truncate">
                {template.subject}
              </p>
            </div>
            {template.isDefault && (
              <span className="ml-2 shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                Default
              </span>
            )}
          </div>

          {template.workstreams.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {template.workstreams.map((ws) => (
                <span
                  key={ws.id}
                  className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400"
                >
                  {ws.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-600">
              {new Date(template.updatedAt).toLocaleDateString()}
            </span>
            <div className="flex gap-1">
              <button
                onClick={(e) => handleDuplicate(template.id, e)}
                className="rounded p-1 text-slate-600 hover:text-slate-300 transition-colors"
                title="Duplicate"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              {!template.isDefault && template.workstreams.length === 0 && (
                <button
                  onClick={(e) => handleDelete(template, e)}
                  className="rounded p-1 text-slate-600 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
