// /app/admin/stages/sortable-stage-item.tsx
"use client";

import { CSS } from "@dnd-kit/utilities";
import {
  useSortable,
  defaultAnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { GripVertical, Edit2, Trash2, Plus } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";

const STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Completed",
  "Cancelled",
  "Approved",
];

type SortableStageItemProps = {
  stage: any;
  subtasks: Record<string, any[]>;
  addSubtask: (id: string, title: string) => void;
  removeSubtask: (id: string, index: number) => void;
  onEdit: (stage: any) => void;
  onDelete: (id: string) => void;
  onStageStatusChange: (id: string, status: string) => void;
};

export function SortableStageItem({
  stage,
  subtasks,
  addSubtask,
  removeSubtask,
  onEdit,
  onDelete,
  onStageStatusChange,
}: SortableStageItemProps) {
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

  const [inputValue, setInputValue] = useState("");

  const stageStatus = stage.status || "Not Started";
  const taskList = subtasks[stage.id] || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border p-3 bg-white shadow-sm"
    >
      {/* Header Row */}
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

      {/* Stage status */}
      <div className="ml-6 mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Stage Status</span>

        <Select
          value={stageStatus}
          onValueChange={(value) => onStageStatusChange(stage.id, value)}
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

      {/* Subtasks section */}
      <div className="ml-6 mt-2 border-t pt-2">
        <div className="text-xs font-semibold text-muted-foreground mb-2">
          Sub-Tasks
        </div>

        {/* Render subtasks */}
        <div className="grid gap-1 mb-2">
          <AnimatePresence>
            {taskList.length > 0 &&
              taskList.map((task, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="text-sm bg-muted p-1 rounded flex items-center justify-between gap-2"
                >
                  <span className="truncate">{task.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-destructive"
                    onClick={() => removeSubtask(stage.id, idx)}
                  >
                    ×
                  </Button>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>

        {/* Add Subtask */}
        <div className="flex gap-1">
          <Input
            size={1}
            placeholder="Add sub-task..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="text-xs h-7"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              if (!inputValue.trim()) return;
              addSubtask(stage.id, inputValue.trim());
              setInputValue("");
            }}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
