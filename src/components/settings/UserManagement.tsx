"use client";

import { useCallback, useEffect, useState } from "react";
import { showSuccess, showError } from "@/components/ToastProvider";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("sender");
  const [adding, setAdding] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/users");
      if (res.ok) setUsers(await res.json());
    } catch {
      showError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAdd = async () => {
    if (!newEmail || !newName) return;
    setAdding(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess("User added");
      setNewEmail("");
      setNewName("");
      setNewRole("sender");
      setShowAddForm(false);
      fetchUsers();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Remove ${user.name} (${user.email})?`)) return;
    try {
      const res = await fetch(`/api/settings/users?id=${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess("User removed");
      fetchUsers();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to remove user");
    }
  };

  const handleRoleChange = async (user: User, role: string) => {
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, name: user.name, role }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showSuccess(`Role updated to ${role}`);
      fetchUsers();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 p-6 h-48" />
    );
  }

  return (
    <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-50">User Management</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          {showAddForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {/* Add user form */}
      {showAddForm && (
        <div className="mb-4 rounded-md border border-slate-700 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-deloitte focus:outline-none"
            />
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-deloitte focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-deloitte focus:outline-none"
              >
                <option value="sender">Sender</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleAdd}
                disabled={adding || !newEmail || !newName}
                className="rounded-md bg-deloitte px-4 py-2 text-sm font-medium text-white hover:bg-deloitte-light disabled:opacity-50 transition-colors"
              >
                {adding ? "..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">
                Name
              </th>
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">
                Email
              </th>
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">
                Role
              </th>
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">
                Last Login
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-800">
                <td className="py-2 pr-4 text-slate-200">{user.name}</td>
                <td className="py-2 pr-4 text-slate-400">{user.email}</td>
                <td className="py-2 pr-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user, e.target.value)}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-deloitte focus:outline-none"
                  >
                    <option value="sender">Sender</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-2 pr-4 text-xs text-slate-500">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="py-2">
                  <button
                    onClick={() => handleDelete(user)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Remove user"
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
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
