// app/admin/stages/sortable-stage-item.tsx

"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import { GripVertical, Edit2, Trash2, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

/* ---------------- TYPES ---------------- */

export interface Subtask {
  title: string;
  status: string;
  due_date?: string | null;
}

export interface SortableStageItemProps {
  stage: {
    id: string;
    name: string;
    order: number;
    isRequired: boolean;
    status: string;

    start_date?: string | null;
    completed_at?: string | null;
  };

  subtasks: Record<string, Subtask[]>;

  updateSubtask: (
    stageId: string,
    index: number,
    updates: Partial<Subtask>
  ) => void;

  addSubtask: (stageId: string, title: string) => void;
  removeSubtask: (stageId: string, index: number) => void;

  onEdit: (stage: any) => void;
  onDelete: (id: string) => void;

  onStageStatusChange: (id: string, status: string) => void;

  onStageStartDateChange: (stageId: string, startDate: string | null) => void;

  clientId?: string;  // For navigating to documents
}

/* -------------- STAGE STATUSES --------------- */

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"];

/* ---------------- COMPONENT ---------------- */

export function SortableStageItem({
  stage,
  subtasks,
  addSubtask,
  removeSubtask,
  onEdit,
  onDelete,
  onStageStatusChange,
  updateSubtask,
  onStageStartDateChange,
  clientId,
}: SortableStageItemProps) {
  const router = useRouter();
  const [showStartDate, setShowStartDate] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage.id,
    animateLayoutChanges: defaultAnimateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const stageStatus = stage.status || "Not Started";
  const stageSubtasks: Subtask[] = subtasks[stage.id] || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border p-3 bg-white shadow-sm"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="size-4 text-muted-foreground" />
          </div>

          <div className="font-medium">{stage.name}</div>

          {stage.isRequired && (
            <span className="rounded bg-muted px-2 py-0.5 text-xs">
              Required
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Order {stage.order}
          </span>

          {/* START DATE PICKER (POPOVER) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={
                  "h-7 text-xs justify-start text-left font-normal " +
                  (!stage.start_date && "text-muted-foreground")
                }
              >
                {stage.start_date ? (
                  `Start: ${stage.start_date}`
                ) : (
                  <span>Start Date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={
                  stage.start_date
                    ? new Date(stage.start_date + "T00:00:00") // Force local midnight parsing if YYYY-MM-DD
                    : undefined
                }
                onSelect={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const day = String(date.getDate()).padStart(2, "0");
                    const isoDate = `${year}-${month}-${day}`;
                    onStageStartDateChange(stage.id, isoDate);
                    // document.dispatchEvent(new MouseEvent('click')); // hack to close? No, let user choose.
                  } else {
                    onStageStartDateChange(stage.id, null);
                  }
                }}
                initialFocus
              />
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full h-6 text-xs text-destructive"
                  onClick={() => onStageStartDateChange(stage.id, null)}
                >
                  Clear Date
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="ghost" onClick={() => onEdit(stage)}>
            <Edit2 className="size-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => onDelete(stage.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* STAGE STATUS */}
      <div className="ml-6 mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Stage Status</span>

        <Select
          value={stageStatus}
          onValueChange={(value: string) => onStageStatusChange(stage.id, value)}
        >
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* SUBTASKS */}
      <div className="ml-6 mt-2 border-t pt-2">
        <div className="text-xs font-semibold text-muted-foreground mb-2">
          Sub-Tasks
        </div>

        {/* SUBTASK LIST */}
        <div className="grid gap-1 mb-2">
          <AnimatePresence>
            {stageSubtasks.map((t, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between bg-gray-100 rounded px-2 py-1 text-sm"
              >
                <Input
                  value={t.title}
                  className={`h-7 text-xs w-[45%] ${!t.title?.trim() ? 'border-red-300 focus:border-red-500' : ''}`}
                  placeholder="Sub-Task*"
                  required
                  onChange={(e) =>
                    updateSubtask(stage.id.toString(), index, {
                      title: e.target.value,
                    })
                  }
                />

                <Input
                  type="date"
                  value={t.due_date ?? ""}
                  className={`h-7 text-xs w-[25%] ${!t.due_date ? 'border-red-300 focus:border-red-500' : ''}`}
                  required
                  onChange={(e) =>
                    updateSubtask(stage.id.toString(), index, {
                      due_date: e.target.value,
                    })
                  }
                />

                <Select
                  value={t.status || "Not Started"}
                  onValueChange={(value) =>
                    updateSubtask(stage.id.toString(), index, { status: value })
                  }
                >
                  <SelectTrigger className="h-7 w-[20%] text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Docs button for completed subtasks - fixed width for alignment */}
                <div className="w-5">
                  {t.status === "Completed" && clientId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-primary"
                      onClick={() => {
                        const folderPath = encodeURIComponent(
                          `Onboarding Stage Completion Documents/${stage.name}-${t.title}`
                        );
                        router.push(`/admin/documents?clientId=${clientId}&folder=${folderPath}`);
                      }}
                      title="View completion documents"
                    >
                      <Eye className="size-4" />
                    </Button>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-destructive"
                  onClick={() => removeSubtask(stage.id, index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-7 flex items-center gap-1 text-xs"
          onClick={() => addSubtask(stage.id.toString(), "")}
        >
          <Plus className="size-4" />
          Add task
        </Button>
      </div>
    </div>
  );
}
