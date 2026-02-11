"use client";

export interface RecipientRule {
  source: "excel_column" | "contact_mapping" | "custom";
  field: string; // e.g. "investment_leader_email", "sel_email", or a custom address
}

export interface RecipientConfigData {
  to: RecipientRule[];
  cc: RecipientRule[];
}

const EXCEL_EMAIL_FIELDS = [
  { value: "investment_leader_email", label: "Investment Leader Email" },
  { value: "requestor_email", label: "Requestor Email" },
];

const CONTACT_MAPPING_FIELDS = [
  { value: "sel_email", label: "SEL Email" },
  { value: "ops_manager_email", label: "Ops Manager Email" },
  { value: "concierge_email", label: "Investment Concierge Email" },
];

export default function RecipientConfig({
  value,
  onChange,
}: {
  value: RecipientConfigData;
  onChange: (v: RecipientConfigData) => void;
}) {
  const addRecipient = (type: "to" | "cc") => {
    onChange({
      ...value,
      [type]: [
        ...value[type],
        { source: "excel_column" as const, field: "" },
      ],
    });
  };

  const updateRecipient = (
    type: "to" | "cc",
    index: number,
    updates: Partial<RecipientRule>
  ) => {
    const list = [...value[type]];
    list[index] = { ...list[index], ...updates };
    // Reset field when source changes
    if (updates.source) {
      list[index].field = "";
    }
    onChange({ ...value, [type]: list });
  };

  const removeRecipient = (type: "to" | "cc", index: number) => {
    onChange({
      ...value,
      [type]: value[type].filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      {/* To Recipients */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-300">
            To Recipients
          </label>
          <button
            onClick={() => addRecipient("to")}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            + Add
          </button>
        </div>
        <RecipientRuleList
          rules={value.to}
          onUpdate={(i, u) => updateRecipient("to", i, u)}
          onRemove={(i) => removeRecipient("to", i)}
        />
        {value.to.length === 0 && (
          <p className="text-xs text-slate-500 py-2">
            No To recipients configured.
          </p>
        )}
      </div>

      {/* CC Recipients */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-300">
            CC Recipients
          </label>
          <button
            onClick={() => addRecipient("cc")}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            + Add
          </button>
        </div>
        <RecipientRuleList
          rules={value.cc}
          onUpdate={(i, u) => updateRecipient("cc", i, u)}
          onRemove={(i) => removeRecipient("cc", i)}
        />
        {value.cc.length === 0 && (
          <p className="text-xs text-slate-500 py-2">
            No CC recipients configured.
          </p>
        )}
      </div>
    </div>
  );
}

function RecipientRuleList({
  rules,
  onUpdate,
  onRemove,
}: {
  rules: RecipientRule[];
  onUpdate: (index: number, updates: Partial<RecipientRule>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {rules.map((rule, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* Source */}
          <select
            value={rule.source}
            onChange={(e) =>
              onUpdate(index, {
                source: e.target.value as RecipientRule["source"],
              })
            }
            className="w-40 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="excel_column">From Excel</option>
            <option value="contact_mapping">From Contacts</option>
            <option value="custom">Custom Email</option>
          </select>

          {/* Field / Email */}
          {rule.source === "excel_column" && (
            <select
              value={rule.field}
              onChange={(e) => onUpdate(index, { field: e.target.value })}
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select field...</option>
              {EXCEL_EMAIL_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          )}

          {rule.source === "contact_mapping" && (
            <select
              value={rule.field}
              onChange={(e) => onUpdate(index, { field: e.target.value })}
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select contact...</option>
              {CONTACT_MAPPING_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          )}

          {rule.source === "custom" && (
            <input
              type="email"
              value={rule.field}
              onChange={(e) => onUpdate(index, { field: e.target.value })}
              placeholder="email@example.com"
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          )}

          {/* Remove */}
          <button
            onClick={() => onRemove(index)}
            className="shrink-0 text-slate-500 hover:text-red-400 transition-colors p-1"
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
  );
}
