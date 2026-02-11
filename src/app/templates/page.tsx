"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import TemplateList from "@/components/templates/TemplateList";
import TemplateEditor from "@/components/templates/TemplateEditor";

export default function TemplatesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const handleSelect = (id: number) => {
    setSelectedId(id < 0 ? null : id);
    setEditorKey((k) => k + 1);
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setEditorKey((k) => k + 1);
  };

  return (
    <div>
      <PageHeader
        title="Email Templates"
        description="Create and edit email templates with dynamic placeholders"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar: Template List */}
        <div className="lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
          <TemplateList
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
            selectedId={selectedId}
          />
        </div>

        {/* Main: Editor */}
        <div>
          {selectedId !== null || editorKey > 0 ? (
            <TemplateEditor
              key={editorKey}
              templateId={selectedId}
              onSaved={() => {
                setEditorKey((k) => k + 1);
              }}
            />
          ) : (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-12 text-center">
              <p className="text-slate-500">
                Select a template or create a new one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
