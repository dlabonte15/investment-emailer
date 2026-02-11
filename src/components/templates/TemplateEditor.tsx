"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { showSuccess, showError } from "@/components/ToastProvider";
import { AVAILABLE_PLACEHOLDERS } from "@/lib/template-renderer";

interface TemplateData {
  id?: number;
  name: string;
  subject: string;
  body: string;
  includeTable: boolean;
  tableColumns: { header: string; placeholder: string }[] | null;
  signature: string;
}

interface PreviewResult {
  subject: string;
  body: string;
  signature: string;
  table: string | null;
  hasSampleData: boolean;
}

export default function TemplateEditor({
  templateId,
  onSaved,
}: {
  templateId: number | null; // null = create new
  onSaved?: () => void;
}) {
  const [template, setTemplate] = useState<TemplateData>({
    name: "",
    subject: "",
    body: "",
    includeTable: false,
    tableColumns: null,
    signature: "Account Investment Concierge",
  });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [placeholderFilter, setPlaceholderFilter] = useState("");
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: "Write your email template here...",
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none min-h-[200px] focus:outline-none px-4 py-3",
      },
      handleKeyDown: (_view, event) => {
        // Auto-open placeholder dropdown when user types the second "{"
        if (event.key === "{") {
          // Check if the character before the cursor is already "{"
          const { state } = _view;
          const { from } = state.selection;
          if (from > 0) {
            const charBefore = state.doc.textBetween(from - 1, from);
            if (charBefore === "{") {
              // Delete the first "{" and open the dropdown instead
              setTimeout(() => {
                setShowPlaceholders(true);
                setPlaceholderFilter("");
              }, 0);
            }
          }
        }
        return false; // don't prevent default
      },
    },
    onUpdate: ({ editor }) => {
      setTemplate((prev) => ({ ...prev, body: editor.getHTML() }));
    },
  });

  // Load template data
  const loadTemplate = useCallback(async () => {
    if (!templateId || templateId < 0) {
      setTemplate({
        name: "",
        subject: "",
        body: "",
        includeTable: false,
        tableColumns: null,
        signature: "Account Investment Concierge",
      });
      editor?.commands.setContent("");
      setPreview(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${templateId}`);
      if (!res.ok) throw new Error("Failed to load template");
      const data = await res.json();
      setTemplate({
        id: data.id,
        name: data.name,
        subject: data.subject,
        body: data.body,
        includeTable: data.includeTable,
        tableColumns: data.tableColumns,
        signature: data.signature,
      });
      editor?.commands.setContent(data.body || "");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [templateId, editor]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  // Debounced preview
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      fetchPreview();
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.subject, template.body, template.signature, template.includeTable, template.tableColumns]);

  const fetchPreview = async () => {
    const previewId = template.id || 0;
    try {
      const res = await fetch(`/api/templates/${previewId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: template.subject,
          body: template.body,
          signature: template.signature,
          includeTable: template.includeTable,
          tableColumns: template.tableColumns,
        }),
      });
      if (res.ok) setPreview(await res.json());
    } catch {
      // Silent fail for preview
    }
  };

  // Save
  const handleSave = async () => {
    if (!template.name || !template.subject) {
      showError("Name and subject are required");
      return;
    }
    setSaving(true);
    try {
      const url = template.id
        ? `/api/templates/${template.id}`
        : "/api/templates";
      const method = template.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          subject: template.subject,
          body: template.body,
          includeTable: template.includeTable,
          tableColumns: template.tableColumns,
          signature: template.signature,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      const saved = await res.json();
      setTemplate((prev) => ({ ...prev, id: saved.id }));
      showSuccess(template.id ? "Template saved" : "Template created");
      onSaved?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Insert placeholder into editor
  const insertPlaceholder = (key: string) => {
    editor?.commands.insertContent(`{{${key}}}`);
    setShowPlaceholders(false);
    setPlaceholderFilter("");
  };

  // Insert placeholder into subject
  const insertSubjectPlaceholder = (key: string) => {
    setTemplate((prev) => ({
      ...prev,
      subject: prev.subject + `{{${key}}}`,
    }));
    setShowPlaceholders(false);
    setPlaceholderFilter("");
  };

  // Table column management
  const addTableColumn = () => {
    setTemplate((prev) => ({
      ...prev,
      tableColumns: [
        ...(prev.tableColumns || []),
        { header: "", placeholder: "" },
      ],
    }));
  };

  const updateTableColumn = (
    index: number,
    field: "header" | "placeholder",
    value: string
  ) => {
    setTemplate((prev) => {
      const cols = [...(prev.tableColumns || [])];
      cols[index] = { ...cols[index], [field]: value };
      return { ...prev, tableColumns: cols };
    });
  };

  const removeTableColumn = (index: number) => {
    setTemplate((prev) => ({
      ...prev,
      tableColumns: (prev.tableColumns || []).filter((_, i) => i !== index),
    }));
  };

  const filteredPlaceholders = AVAILABLE_PLACEHOLDERS.filter(
    (p) =>
      p.key.includes(placeholderFilter.toLowerCase()) ||
      p.description.toLowerCase().includes(placeholderFilter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-96" />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Editor Panel */}
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={template.name}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Earmarked Investments"
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, subject: e.target.value }))
              }
              onKeyDown={(e) => {
                // Auto-open placeholder dropdown when user types "{{" in subject
                if (e.key === "{") {
                  const input = e.currentTarget;
                  const pos = input.selectionStart ?? 0;
                  if (pos > 0 && template.subject[pos - 1] === "{") {
                    setTimeout(() => {
                      setShowPlaceholders(true);
                      setPlaceholderFilter("");
                    }, 0);
                  }
                }
              }}
              placeholder="Investment Follow-Up: {{account_name}}"
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 border-b border-slate-700 pb-2">
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive("bold")}
              title="Bold"
            >
              B
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive("italic")}
              title="Italic"
            >
              <em>I</em>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              active={editor?.isActive("underline")}
              title="Underline"
            >
              <u>U</u>
            </ToolbarBtn>
            <span className="mx-1 h-4 w-px bg-slate-700" />
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive("bulletList")}
              title="Bullet List"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive("orderedList")}
              title="Numbered List"
            >
              1.
            </ToolbarBtn>
            <span className="mx-1 h-4 w-px bg-slate-700" />
            <div className="relative">
              <ToolbarBtn
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                active={showPlaceholders}
                title="Insert Placeholder"
              >
                {"{{ }}"}
              </ToolbarBtn>
              {showPlaceholders && (
                <PlaceholderDropdown
                  filter={placeholderFilter}
                  onFilterChange={setPlaceholderFilter}
                  placeholders={filteredPlaceholders}
                  onInsert={insertPlaceholder}
                  onInsertSubject={insertSubjectPlaceholder}
                  onClose={() => {
                    setShowPlaceholders(false);
                    setPlaceholderFilter("");
                  }}
                />
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="rounded-md border border-slate-600 bg-slate-800 min-h-[200px]">
            <EditorContent editor={editor} />
          </div>

          {/* Signature */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Signature
            </label>
            <input
              type="text"
              value={template.signature}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, signature: e.target.value }))
              }
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Table Builder */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.includeTable}
                onChange={(e) =>
                  setTemplate((prev) => ({
                    ...prev,
                    includeTable: e.target.checked,
                    tableColumns: e.target.checked
                      ? prev.tableColumns || []
                      : prev.tableColumns,
                  }))
                }
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className="text-sm text-slate-300">
                Include data table
              </span>
            </label>

            {template.includeTable && (
              <div className="mt-3 space-y-2">
                {(template.tableColumns || []).map((col, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={col.header}
                      onChange={(e) =>
                        updateTableColumn(i, "header", e.target.value)
                      }
                      placeholder="Column header"
                      className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    />
                    <select
                      value={col.placeholder}
                      onChange={(e) =>
                        updateTableColumn(i, "placeholder", e.target.value)
                      }
                      className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select field...</option>
                      {AVAILABLE_PLACEHOLDERS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.key}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeTableColumn(i)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addTableColumn}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  + Add Column
                </button>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving
                ? "Saving..."
                : template.id
                  ? "Save Template"
                  : "Create Template"}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h3 className="text-sm font-medium text-slate-400 mb-3">
          Live Preview
          {preview && !preview.hasSampleData && (
            <span className="ml-2 text-xs text-amber-400">
              (no sample data loaded)
            </span>
          )}
        </h3>

        {preview ? (
          <div className="space-y-3">
            {/* Subject preview */}
            <div className="rounded-md bg-slate-800 px-3 py-2">
              <span className="text-xs text-slate-500">Subject: </span>
              <span className="text-sm text-slate-200">
                {preview.subject}
              </span>
            </div>

            {/* Body preview */}
            <div
              className="rounded-md bg-slate-800 px-4 py-3 text-sm text-slate-300 prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: preview.body }}
            />

            {/* Table preview */}
            {preview.table && (
              <div className="overflow-x-auto">
                <PreviewTable data={preview.table} />
              </div>
            )}

            {/* Signature preview */}
            <div className="border-t border-slate-700 pt-2 text-sm text-slate-400">
              {preview.signature}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Start typing to see a preview...
          </p>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function PlaceholderDropdown({
  filter,
  onFilterChange,
  placeholders,
  onInsert,
  onInsertSubject,
  onClose,
}: {
  filter: string;
  onFilterChange: (v: string) => void;
  placeholders: readonly { key: string; source: string; description: string }[];
  onInsert: (key: string) => void;
  onInsertSubject: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-slate-600 bg-slate-800 shadow-xl">
      <div className="p-2 border-b border-slate-700">
        <input
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter placeholders..."
          autoFocus
          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
      </div>
      <div className="max-h-60 overflow-y-auto p-1">
        {placeholders.map((p) => (
          <div
            key={p.key}
            className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-700 group"
          >
            <div className="min-w-0">
              <span className="text-xs font-mono text-blue-400">
                {`{{${p.key}}}`}
              </span>
              <p className="text-[10px] text-slate-500 truncate">
                {p.description}
              </p>
            </div>
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => onInsert(p.key)}
                className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white"
                title="Insert into body"
              >
                Body
              </button>
              <button
                onClick={() => onInsertSubject(p.key)}
                className="rounded bg-slate-600 px-1.5 py-0.5 text-[10px] text-white"
                title="Insert into subject"
              >
                Subj
              </button>
            </div>
          </div>
        ))}
        {placeholders.length === 0 && (
          <p className="text-xs text-slate-500 p-2 text-center">
            No matching placeholders
          </p>
        )}
      </div>
    </div>
  );
}

function PreviewTable({ data }: { data: string }) {
  try {
    const parsed = JSON.parse(data) as {
      headers: string[];
      rows: string[][];
    };
    return (
      <table className="w-full text-sm border border-slate-600">
        <thead>
          <tr className="bg-slate-700">
            {parsed.headers.map((h, i) => (
              <th
                key={i}
                className="border border-slate-600 px-3 py-1.5 text-left text-xs font-medium text-slate-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-slate-600 px-3 py-1.5 text-xs text-slate-400"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } catch {
    return null;
  }
}
