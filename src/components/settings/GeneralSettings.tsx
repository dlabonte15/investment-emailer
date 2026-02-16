"use client";

import { useCallback, useEffect, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";

interface Settings {
  defaultSenderName: string;
  defaultSenderEmail: string;
  globalCcEmails: string;
  sendAsHtml: boolean;
  timezone: string;
  dataSourceType: string;
  onedriveFileId: string | null;
  excelSheetName: string;
  dataFreshnessWarningDays: number;
  enableOpenTracking: boolean;
  defaultDedupeWindowDays: number;
  defaultEscalationThreshold: number;
}

export default function GeneralSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingDedupe, setClearingDedupe] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) setSettings(await res.json());
    } catch {
      showError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSettings(await res.json());
      showSuccess("Settings saved");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof Settings, value: unknown) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-48" />
    );
  }

  if (!settings) {
    return (
      <div className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <p className="text-red-400">Failed to load settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-4">
          General Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Default Sender Name"
            value={settings.defaultSenderName}
            onChange={(v) => update("defaultSenderName", v)}
          />
          <Field
            label="Default Sender Email"
            value={settings.defaultSenderEmail}
            onChange={(v) => update("defaultSenderEmail", v)}
            placeholder="sender@example.com"
          />
          <Field
            label="Global CC Emails"
            value={settings.globalCcEmails}
            onChange={(v) => update("globalCcEmails", v)}
            placeholder="Comma-separated email addresses"
            className="md:col-span-2"
          />
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Email Format
            </label>
            <select
              value={settings.sendAsHtml ? "html" : "plain"}
              onChange={(e) => update("sendAsHtml", e.target.value === "html")}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
            >
              <option value="html">HTML</option>
              <option value="plain">Plain Text</option>
            </select>
          </div>
          <Field
            label="Timezone"
            value={settings.timezone}
            onChange={(v) => update("timezone", v)}
          />
        </div>
      </section>

      {/* Data Source Settings */}
      <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-4">
          Data Source Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Source Type
            </label>
            <select
              value={settings.dataSourceType}
              onChange={(e) => update("dataSourceType", e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
            >
              <option value="upload">Manual Upload</option>
              <option value="onedrive">OneDrive (Graph API)</option>
            </select>
          </div>
          <Field
            label="Excel Sheet Name"
            value={settings.excelSheetName}
            onChange={(v) => update("excelSheetName", v)}
          />
          {settings.dataSourceType === "onedrive" && (
            <Field
              label="OneDrive File ID"
              value={settings.onedriveFileId || ""}
              onChange={(v) => update("onedriveFileId", v || null)}
              placeholder="OneDrive item ID"
              className="md:col-span-2"
            />
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Freshness Warning (days)
            </label>
            <input
              type="number"
              min={1}
              value={settings.dataFreshnessWarningDays}
              onChange={(e) =>
                update(
                  "dataFreshnessWarningDays",
                  parseInt(e.target.value) || 7
                )
              }
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Deduplication & Escalation Settings */}
      <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-4">
          Deduplication & Escalation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Default Dedupe Window (days)
            </label>
            <input
              type="number"
              min={1}
              value={settings.defaultDedupeWindowDays}
              onChange={(e) =>
                update(
                  "defaultDedupeWindowDays",
                  parseInt(e.target.value) || 7
                )
              }
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Default Escalation Threshold
            </label>
            <input
              type="number"
              min={1}
              value={settings.defaultEscalationThreshold}
              onChange={(e) =>
                update(
                  "defaultEscalationThreshold",
                  parseInt(e.target.value) || 3
                )
              }
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Clear All Dedupe Logs</p>
              <p className="text-xs text-slate-500">
                Removes all deduplication records. Next run will treat all emails as new.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Are you sure? This will clear all deduplication logs and allow all emails to be re-sent.")) return;
                setClearingDedupe(true);
                try {
                  const res = await fetch("/api/settings/clear-dedupe-logs", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to clear");
                  showSuccess(`Cleared ${data.deletedCount} dedupe log(s)`);
                } catch (err) {
                  showError(err instanceof Error ? err.message : "Failed to clear dedupe logs");
                } finally {
                  setClearingDedupe(false);
                }
              }}
              disabled={clearingDedupe}
              className="px-3 py-1.5 text-sm text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/10 disabled:opacity-50"
            >
              {clearingDedupe ? "Clearing..." : "Clear Dedupe Logs"}
            </button>
          </div>
        </div>
      </section>

      {/* Email Tracking Settings */}
      <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-4">
          Email Tracking
        </h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enableOpenTracking}
            onChange={(e) => update("enableOpenTracking", e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-deloitte focus:ring-deloitte"
          />
          <span className="text-sm text-slate-300">
            Enable open tracking (embeds 1x1 tracking pixel in HTML emails)
          </span>
        </label>
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-deloitte px-4 py-2 text-sm font-medium text-white hover:bg-deloitte-light disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-deloitte focus:outline-none"
      />
    </div>
  );
}
