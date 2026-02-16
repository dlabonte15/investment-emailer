"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { showSuccess, showError } from "@/components/ToastProvider";

interface WorkstreamSummary {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  cadence: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  template: { id: number; name: string };
}

export default function WorkstreamList({
  onSelect,
  onCreateNew,
  selectedId,
  refreshKey,
}: {
  onSelect: (id: number) => void;
  onCreateNew: () => void;
  selectedId: number | null;
  refreshKey: number;
}) {
  const [workstreams, setWorkstreams] = useState<WorkstreamSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchWorkstreams = useCallback(async () => {
    try {
      const res = await fetch("/api/workstreams");
      if (res.ok) setWorkstreams(await res.json());
    } catch {
      showError("Failed to load workstreams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkstreams();
  }, [fetchWorkstreams, refreshKey]);

  const toggleEnabled = async (ws: WorkstreamSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/workstreams/${ws.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !ws.enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setWorkstreams((prev) =>
        prev.map((w) =>
          w.id === ws.id ? { ...w, enabled: !ws.enabled } : w
        )
      );
      showSuccess(`${ws.name} ${ws.enabled ? "disabled" : "enabled"}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to toggle");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = workstreams.findIndex((w) => w.id === active.id);
    const newIndex = workstreams.findIndex((w) => w.id === over.id);

    const reordered = arrayMove(workstreams, oldIndex, newIndex);
    setWorkstreams(reordered);

    // Persist the new order
    try {
      const res = await fetch("/api/workstreams/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((w) => w.id) }),
      });
      if (!res.ok) throw new Error("Failed to save order");
    } catch {
      showError("Failed to save order");
      fetchWorkstreams(); // revert on failure
    }
  };

  const cadenceLabel = (cadence: string) => {
    switch (cadence) {
      case "weekly":
        return "Weekly";
      case "daily":
        return "Daily";
      case "manual":
        return "Manual";
      case "custom":
        return "Custom";
      default:
        return cadence;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg bg-slate-900 border border-slate-700 h-20"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={onCreateNew}
        className="w-full rounded-lg border-2 border-dashed border-slate-600 p-4 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
      >
        + Create New Workstream
      </button>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={workstreams.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          {workstreams.map((ws) => (
            <SortableWorkstreamCard
              key={ws.id}
              ws={ws}
              isSelected={selectedId === ws.id}
              onSelect={onSelect}
              onToggle={toggleEnabled}
              cadenceLabel={cadenceLabel}
            />
          ))}
        </SortableContext>
      </DndContext>

      {workstreams.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">
          No workstreams configured yet.
        </p>
      )}
    </div>
  );
}

function SortableWorkstreamCard({
  ws,
  isSelected,
  onSelect,
  onToggle,
  cadenceLabel,
}: {
  ws: WorkstreamSummary;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onToggle: (ws: WorkstreamSummary, e: React.MouseEvent) => void;
  cadenceLabel: (c: string) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ws.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(ws.id)}
      className={`
        cursor-pointer rounded-lg border p-4 transition-colors
        ${
          isSelected
            ? "border-deloitte bg-deloitte-dark/20"
            : "border-slate-700 bg-slate-900 hover:border-slate-600"
        }
      `}
    >
      <div className="flex items-start justify-between">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mr-2 mt-0.5 cursor-grab touch-none rounded p-1 text-slate-600 hover:bg-slate-800 hover:text-slate-400 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-slate-200 truncate">
              {ws.name}
            </h3>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                ws.enabled
                  ? "bg-green-900/30 text-green-400"
                  : "bg-slate-700 text-slate-500"
              }`}
            >
              {ws.enabled ? "Active" : "Disabled"}
            </span>
          </div>
          {ws.description && (
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {ws.description}
            </p>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={(e) => onToggle(ws, e)}
          className={`
            shrink-0 ml-2 relative inline-flex h-5 w-9 items-center rounded-full transition-colors
            ${ws.enabled ? "bg-deloitte" : "bg-slate-600"}
          `}
        >
          <span
            className={`
              inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform
              ${ws.enabled ? "translate-x-4" : "translate-x-0.5"}
            `}
          />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500 ml-8">
        <span>{cadenceLabel(ws.cadence)}</span>
        <span className="text-slate-700">|</span>
        <span>{ws.template.name}</span>
        {ws.lastRunAt && (
          <>
            <span className="text-slate-700">|</span>
            <span>
              Last: {new Date(ws.lastRunAt).toLocaleDateString()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
