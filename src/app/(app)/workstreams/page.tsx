"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import WorkstreamList from "@/components/workstreams/WorkstreamList";
import WorkstreamEditor from "@/components/workstreams/WorkstreamEditor";

export default function WorkstreamsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setEditorKey((k) => k + 1);
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setEditorKey((k) => k + 1);
  };

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleDeleted = () => {
    setSelectedId(null);
    setEditorKey((k) => k + 1);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <PageHeader
        title="Workstream Manager"
        description="Configure automation rules and trigger conditions"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar: Workstream List */}
        <div className="lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
          <WorkstreamList
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
            selectedId={selectedId}
            refreshKey={refreshKey}
          />
        </div>

        {/* Main: Editor */}
        <div>
          {selectedId !== null || editorKey > 0 ? (
            <WorkstreamEditor
              key={editorKey}
              workstreamId={selectedId}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ) : (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-12 text-center">
              <p className="text-slate-500">
                Select a workstream or create a new one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
