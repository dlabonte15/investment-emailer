"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";

interface Contact {
  id: number;
  primaryIndustry: string;
  selName: string;
  selEmail: string;
  opsManagerName: string;
  opsManagerEmail: string;
  conciergeName: string;
  conciergeEmail: string;
}

export default function ContactMappingTable({
  onDataChange,
}: {
  onDataChange?: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    id: number;
    field: keyof Contact;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const [newContact, setNewContact] = useState({
    primaryIndustry: "",
    selName: "",
    selEmail: "",
    opsManagerName: "",
    opsManagerEmail: "",
    conciergeName: "US Consulting Account Investment Concierge",
    conciergeEmail: "accountinvestmentcommittee@deloitte.com",
  });

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) setContacts(await res.json());
    } catch {
      showError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Inline edit: start
  const startEdit = (id: number, field: keyof Contact, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  // Inline edit: save on blur
  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const original = contacts.find((c) => c.id === id);
    if (!original || original[field] === editValue) {
      setEditingCell(null);
      return;
    }

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: editValue }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      onDataChange?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save");
    }
    setEditingCell(null);
  };

  // Add new contact
  const handleAdd = async () => {
    if (!newContact.primaryIndustry || !newContact.selName || !newContact.selEmail) {
      showError("Primary Industry, SEL Name, and SEL Email are required");
      return;
    }
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess("Contact added");
      setShowAddRow(false);
      setNewContact({
        primaryIndustry: "",
        selName: "",
        selEmail: "",
        opsManagerName: "",
        opsManagerEmail: "",
        conciergeName: "US Consulting Account Investment Concierge",
        conciergeEmail: "accountinvestmentcommittee@deloitte.com",
      });
      fetchContacts();
      onDataChange?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add contact");
    }
  };

  // Delete
  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Delete mapping for "${contact.primaryIndustry}"?`)) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess("Contact deleted");
      fetchContacts();
      onDataChange?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      showSuccess(
        `Imported: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
      );
      fetchContacts();
      onDataChange?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const editableFields: (keyof Contact)[] = [
    "primaryIndustry",
    "selName",
    "selEmail",
    "opsManagerName",
    "opsManagerEmail",
    "conciergeName",
    "conciergeEmail",
  ];

  const columnHeaders: Record<string, string> = {
    primaryIndustry: "Primary Industry",
    selName: "SEL Name",
    selEmail: "SEL Email",
    opsManagerName: "Ops Manager",
    opsManagerEmail: "Ops Manager Email",
    conciergeName: "Concierge",
    conciergeEmail: "Concierge Email",
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-64" />
    );
  }

  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 p-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">
            Industry Contact Mappings
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Click any cell to edit inline. {contacts.length} mapping
            {contacts.length !== 1 ? "s" : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {importing ? "Importing..." : "Import Excel"}
          </button>
          <a
            href="/api/contacts/export"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Export Excel
          </a>
          <button
            onClick={() => setShowAddRow(!showAddRow)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            {showAddRow ? "Cancel" : "+ Add Industry"}
          </button>
        </div>
      </div>

      {/* Add row form */}
      {showAddRow && (
        <div className="mb-4 rounded-md border border-slate-700 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Primary Industry *"
              value={newContact.primaryIndustry}
              onChange={(e) =>
                setNewContact({ ...newContact, primaryIndustry: e.target.value })
              }
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="SEL Name *"
              value={newContact.selName}
              onChange={(e) =>
                setNewContact({ ...newContact, selName: e.target.value })
              }
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="email"
              placeholder="SEL Email *"
              value={newContact.selEmail}
              onChange={(e) =>
                setNewContact({ ...newContact, selEmail: e.target.value })
              }
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Ops Manager Name"
              value={newContact.opsManagerName}
              onChange={(e) =>
                setNewContact({ ...newContact, opsManagerName: e.target.value })
              }
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="email"
              placeholder="Ops Manager Email"
              value={newContact.opsManagerEmail}
              onChange={(e) =>
                setNewContact({
                  ...newContact,
                  opsManagerEmail: e.target.value,
                })
              }
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleAdd}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {editableFields.map((field) => (
                <th
                  key={field}
                  className="text-left py-2 pr-3 text-xs text-slate-400 font-medium whitespace-nowrap"
                >
                  {columnHeaders[field]}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b border-slate-800 group">
                {editableFields.map((field) => (
                  <td key={field} className="py-1.5 pr-2">
                    {editingCell?.id === contact.id &&
                    editingCell?.field === field ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        autoFocus
                        className="w-full rounded border border-blue-500 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:outline-none"
                      />
                    ) : (
                      <span
                        onClick={() =>
                          startEdit(
                            contact.id,
                            field,
                            String(contact[field])
                          )
                        }
                        className="block cursor-pointer rounded px-2 py-1 text-slate-300 hover:bg-slate-800 truncate max-w-[200px]"
                        title={String(contact[field])}
                      >
                        {contact[field] || (
                          <span className="text-slate-600 italic">empty</span>
                        )}
                      </span>
                    )}
                  </td>
                ))}
                <td className="py-1.5">
                  <button
                    onClick={() => handleDelete(contact)}
                    className="text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all p-1"
                    title="Delete"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td
                  colSpan={editableFields.length + 1}
                  className="py-8 text-center text-slate-500"
                >
                  No contact mappings. Add one or import from Excel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Also export the prefill helper for UnmatchedIndustriesPanel
export function createPrefillContact(industry: string) {
  return {
    primaryIndustry: industry,
    selName: "",
    selEmail: "",
    opsManagerName: "",
    opsManagerEmail: "",
    conciergeName: "US Consulting Account Investment Concierge",
    conciergeEmail: "accountinvestmentcommittee@deloitte.com",
  };
}
