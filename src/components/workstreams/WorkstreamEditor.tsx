"use client";

import { useCallback, useEffect, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";
import TriggerConditionBuilder, {
  type TriggerLogic,
} from "./TriggerConditionBuilder";
import RecipientConfig, {
  type RecipientConfigData,
} from "./RecipientConfig";

interface Template {
  id: number;
  name: string;
}

interface SubTemplateRule {
  field: string;
  value: string;
  templateId: number;
}

interface WorkstreamData {
  id?: number;
  name: string;
  description: string;
  enabled: boolean;
  cadence: string;
  cronExpression: string;
  triggerLogic: TriggerLogic;
  recipientConfig: RecipientConfigData;
  subTemplateLogic: SubTemplateRule[] | null;
  dedupeWindowDays: number;
  escalationThreshold: number;
  autoApprove: boolean;
  templateId: number | null;
}

const DEFAULT_WORKSTREAM: WorkstreamData = {
  name: "",
  description: "",
  enabled: true,
  cadence: "manual",
  cronExpression: "",
  triggerLogic: { conditions: [], logic: "AND" },
  recipientConfig: { to: [], cc: [] },
  subTemplateLogic: null,
  dedupeWindowDays: 7,
  escalationThreshold: 3,
  autoApprove: false,
  templateId: null,
};

export default function WorkstreamEditor({
  workstreamId,
  onSaved,
  onDeleted,
}: {
  workstreamId: number | null;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  const [ws, setWs] = useState<WorkstreamData>({ ...DEFAULT_WORKSTREAM });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [showSubTemplate, setShowSubTemplate] = useState(false);

  // Fetch templates list
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .catch(() => {});
  }, []);

  // Load workstream
  const loadWorkstream = useCallback(async () => {
    if (!workstreamId || workstreamId < 0) {
      setWs({ ...DEFAULT_WORKSTREAM });
      setMatchCount(null);
      setShowSubTemplate(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/workstreams/${workstreamId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setWs({
        id: data.id,
        name: data.name,
        description: data.description || "",
        enabled: data.enabled,
        cadence: data.cadence,
        cronExpression: data.cronExpression || "",
        triggerLogic: data.triggerLogic || { conditions: [], logic: "AND" },
        recipientConfig: data.recipientConfig || { to: [], cc: [] },
        subTemplateLogic: data.subTemplateLogic || null,
        dedupeWindowDays: data.dedupeWindowDays,
        escalationThreshold: data.escalationThreshold,
        autoApprove: data.autoApprove,
        templateId: data.templateId,
      });
      setShowSubTemplate(!!data.subTemplateLogic);
    } catch {
      showError("Failed to load workstream");
    } finally {
      setLoading(false);
    }
  }, [workstreamId]);

  useEffect(() => {
    loadWorkstream();
  }, [loadWorkstream]);

  // Fetch match count when trigger changes
  useEffect(() => {
    if (!ws.id) {
      setMatchCount(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workstreams/${ws.id}/preview`);
        if (res.ok) {
          const data = await res.json();
          setMatchCount(data.matchCount);
        }
      } catch {
        // Silent
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [ws.id, ws.triggerLogic]);

  const update = <K extends keyof WorkstreamData>(
    field: K,
    value: WorkstreamData[K]
  ) => {
    setWs((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!ws.name) {
      showError("Name is required");
      return;
    }
    if (!ws.templateId) {
      showError("Please select a template");
      return;
    }
    setSaving(true);
    try {
      const url = ws.id
        ? `/api/workstreams/${ws.id}`
        : "/api/workstreams";
      const method = ws.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ws.name,
          description: ws.description || null,
          enabled: ws.enabled,
          cadence: ws.cadence,
          cronExpression: ws.cronExpression || null,
          triggerLogic: ws.triggerLogic,
          recipientConfig: ws.recipientConfig,
          subTemplateLogic: showSubTemplate ? ws.subTemplateLogic : null,
          dedupeWindowDays: ws.dedupeWindowDays,
          escalationThreshold: ws.escalationThreshold,
          autoApprove: ws.autoApprove,
          templateId: ws.templateId,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      const saved = await res.json();
      setWs((prev) => ({ ...prev, id: saved.id }));
      showSuccess(ws.id ? "Workstream saved" : "Workstream created");
      onSaved?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!ws.id) return;
    if (
      !confirm(
        `Delete workstream "${ws.name}"? This will remove all associated dedupe logs and escalation records.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/workstreams/${ws.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess("Workstream deleted");
      onDeleted?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Sub-template logic helpers
  const addSubTemplateRule = () => {
    setWs((prev) => ({
      ...prev,
      subTemplateLogic: [
        ...(prev.subTemplateLogic || []),
        { field: "", value: "", templateId: 0 },
      ],
    }));
  };

  const updateSubTemplateRule = (
    index: number,
    updates: Partial<SubTemplateRule>
  ) => {
    setWs((prev) => {
      const rules = [...(prev.subTemplateLogic || [])];
      rules[index] = { ...rules[index], ...updates };
      return { ...prev, subTemplateLogic: rules };
    });
  };

  const removeSubTemplateRule = (index: number) => {
    setWs((prev) => ({
      ...prev,
      subTemplateLogic: (prev.subTemplateLogic || []).filter(
        (_, i) => i !== index
      ),
    }));
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-96" />
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6 space-y-6">
      {/* Name & Description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name</label>
          <input
            type="text"
            value={ws.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g., Earmarked Investments"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Description
          </label>
          <input
            type="text"
            value={ws.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Optional description"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Cadence */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Cadence</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={ws.cadence}
            onChange={(e) => update("cadence", e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="manual">Manual Only</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom Cron</option>
          </select>

          {ws.cadence === "custom" && (
            <input
              type="text"
              value={ws.cronExpression}
              onChange={(e) => update("cronExpression", e.target.value)}
              placeholder="0 8 * * 1 (Mon 8am)"
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 font-mono placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          )}

          {ws.cadence === "weekly" && (
            <input
              type="text"
              value={ws.cronExpression}
              onChange={(e) => update("cronExpression", e.target.value)}
              placeholder="0 8 * * 1 (day + time)"
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 font-mono placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          )}

          {ws.cadence === "daily" && (
            <input
              type="text"
              value={ws.cronExpression}
              onChange={(e) => update("cronExpression", e.target.value)}
              placeholder="0 8 * * * (time)"
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 font-mono placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* Trigger Conditions */}
      <div className="border-t border-slate-700 pt-4">
        <TriggerConditionBuilder
          value={ws.triggerLogic}
          onChange={(v) => update("triggerLogic", v)}
          matchCount={matchCount}
        />
      </div>

      {/* Recipients */}
      <div className="border-t border-slate-700 pt-4">
        <RecipientConfig
          value={ws.recipientConfig}
          onChange={(v) => update("recipientConfig", v)}
        />
      </div>

      {/* Template */}
      <div className="border-t border-slate-700 pt-4">
        <label className="block text-xs text-slate-400 mb-1">
          Email Template
        </label>
        <select
          value={ws.templateId || ""}
          onChange={(e) =>
            update("templateId", e.target.value ? parseInt(e.target.value) : null)
          }
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Sub-template logic */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSubTemplate}
              onChange={(e) => setShowSubTemplate(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500"
            />
            <span className="text-sm text-slate-300">
              Conditional template selection
            </span>
          </label>
          <p className="text-[10px] text-slate-500 mt-0.5 ml-6">
            Override the template based on a field value (e.g., different
            templates for Closed Lost vs Closed Abandoned)
          </p>

          {showSubTemplate && (
            <div className="mt-3 ml-6 space-y-2">
              {(ws.subTemplateLogic || []).map((rule, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">If</span>
                  <input
                    type="text"
                    value={rule.field}
                    onChange={(e) =>
                      updateSubTemplateRule(index, { field: e.target.value })
                    }
                    placeholder="field name"
                    className="w-36 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 font-mono placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">=</span>
                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) =>
                      updateSubTemplateRule(index, { value: e.target.value })
                    }
                    placeholder="value"
                    className="w-36 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">use</span>
                  <select
                    value={rule.templateId || ""}
                    onChange={(e) =>
                      updateSubTemplateRule(index, {
                        templateId: parseInt(e.target.value) || 0,
                      })
                    }
                    className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeSubTemplateRule(index)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={addSubTemplateRule}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                + Add Rule
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="border-t border-slate-700 pt-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Advanced Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Dedupe Window (days)
            </label>
            <input
              type="number"
              min={0}
              value={ws.dedupeWindowDays}
              onChange={(e) =>
                update("dedupeWindowDays", parseInt(e.target.value) || 0)
              }
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Escalation Threshold
            </label>
            <input
              type="number"
              min={1}
              value={ws.escalationThreshold}
              onChange={(e) =>
                update("escalationThreshold", parseInt(e.target.value) || 3)
              }
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={ws.autoApprove}
                onChange={(e) => update("autoApprove", e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className="text-sm text-slate-300">
                Auto-approve sends
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
        <div>
          {ws.id && (
            <button
              onClick={handleDelete}
              className="rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
            >
              Delete Workstream
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving
            ? "Saving..."
            : ws.id
              ? "Save Workstream"
              : "Create Workstream"}
        </button>
      </div>
    </div>
  );
}
