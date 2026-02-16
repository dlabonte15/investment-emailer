"use client";

import { AVAILABLE_PLACEHOLDERS } from "@/lib/template-renderer";

export interface TriggerCondition {
  field: string;
  operator: string;
  value: string | number | string[];
}

export interface TriggerLogic {
  conditions: TriggerCondition[];
  logic: "AND" | "OR";
}

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "in", label: "in (comma-separated)" },
  { value: "not_in", label: "not in" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
  { value: "older_than_days", label: "older than (days)" },
  { value: "newer_than_days", label: "newer than (days)" },
];

const NO_VALUE_OPERATORS = ["is_empty", "is_not_empty"];

const FIELDS = AVAILABLE_PLACEHOLDERS.filter((p) => p.source === "Excel").map(
  (p) => ({ value: p.key, label: p.key })
);

export default function TriggerConditionBuilder({
  value,
  onChange,
  matchCount,
}: {
  value: TriggerLogic;
  onChange: (v: TriggerLogic) => void;
  matchCount?: number | null;
}) {
  const addCondition = () => {
    onChange({
      ...value,
      conditions: [
        ...value.conditions,
        { field: "", operator: "equals", value: "" },
      ],
    });
  };

  const updateCondition = (
    index: number,
    updates: Partial<TriggerCondition>
  ) => {
    const conditions = [...value.conditions];
    conditions[index] = { ...conditions[index], ...updates };
    onChange({ ...value, conditions });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...value,
      conditions: value.conditions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">
          Trigger Conditions
        </label>
        {matchCount !== null && matchCount !== undefined && (
          <span className="rounded bg-deloitte-dark/30 px-2 py-0.5 text-xs text-deloitte-light">
            {matchCount} investment{matchCount !== 1 ? "s" : ""} match
          </span>
        )}
      </div>

      {value.conditions.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-slate-400">Combine with:</span>
          <button
            onClick={() => onChange({ ...value, logic: "AND" })}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              value.logic === "AND"
                ? "bg-deloitte text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            AND
          </button>
          <button
            onClick={() => onChange({ ...value, logic: "OR" })}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              value.logic === "OR"
                ? "bg-deloitte text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            OR
          </button>
        </div>
      )}

      <div className="space-y-2">
        {value.conditions.map((condition, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <span className="shrink-0 text-xs text-slate-500 w-8 text-center">
                {value.logic}
              </span>
            )}
            {index === 0 && value.conditions.length > 1 && (
              <span className="shrink-0 w-8" />
            )}

            {/* Field */}
            <select
              value={condition.field}
              onChange={(e) =>
                updateCondition(index, { field: e.target.value })
              }
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
            >
              <option value="">Select field...</option>
              {FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Operator */}
            <select
              value={condition.operator}
              onChange={(e) =>
                updateCondition(index, { operator: e.target.value })
              }
              className="w-44 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {/* Value */}
            {!NO_VALUE_OPERATORS.includes(condition.operator) && (
              <input
                type="text"
                value={
                  Array.isArray(condition.value)
                    ? condition.value.join(", ")
                    : String(condition.value)
                }
                onChange={(e) =>
                  updateCondition(index, { value: e.target.value })
                }
                placeholder={
                  condition.operator === "in" || condition.operator === "not_in"
                    ? "val1, val2, val3"
                    : condition.operator === "older_than_days" ||
                        condition.operator === "newer_than_days"
                      ? "Number of days"
                      : "Value"
                }
                className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-deloitte focus:outline-none"
              />
            )}

            {/* Remove */}
            <button
              onClick={() => removeCondition(index)}
              className="shrink-0 text-slate-500 hover:text-red-400 transition-colors p-1"
              title="Remove condition"
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
          </div>
        ))}
      </div>

      <button
        onClick={addCondition}
        className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
      >
        + Add Condition
      </button>
    </div>
  );
}
