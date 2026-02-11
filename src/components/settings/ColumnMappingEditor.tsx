"use client";

import { useCallback, useEffect, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";

interface Mapping {
  id?: number;
  internalField: string;
  excelColumn: string;
}

export default function ColumnMappingEditor() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/column-mappings");
      if (res.ok) setMappings(await res.json());
    } catch {
      showError("Failed to load column mappings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/column-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMappings(await res.json());
      showSuccess("Column mappings saved");
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to save column mappings"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (index: number, field: keyof Mapping, value: string) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addMapping = () => {
    setMappings((prev) => [
      ...prev,
      { internalField: "", excelColumn: "" },
    ]);
  };

  const removeMapping = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-48" />
    );
  }

  return (
    <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-50">Column Mappings</h2>
        <span className="text-xs text-slate-500">
          {mappings.length} mapping{mappings.length !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Maps internal field names to Excel column headers. These are used when
        parsing uploaded data files.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">
                Internal Field
              </th>
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">
                Excel Column
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => (
              <tr key={index} className="border-b border-slate-800">
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={mapping.internalField}
                    onChange={(e) =>
                      updateMapping(index, "internalField", e.target.value)
                    }
                    className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={mapping.excelColumn}
                    onChange={(e) =>
                      updateMapping(index, "excelColumn", e.target.value)
                    }
                    className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </td>
                <td className="py-2">
                  <button
                    onClick={() => removeMapping(index)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Remove mapping"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={addMapping}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          + Add Mapping
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Mappings"}
        </button>
      </div>
    </section>
  );
}
