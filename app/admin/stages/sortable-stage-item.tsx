//  app/admin/stages/sortable-stage-item.tsx
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
// import { useState } from "react";
import { useState, useRef } from "react";

import { motion, AnimatePresence } from "framer-motion";



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
  };
  subtasks: Record<string, Subtask[]>;
  // updateSubtask: (stageId: string, index: number, title: string) => void;
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
}

/* -------------- STAGE STATUSES --------------- */

const STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Completed",
  // "Cancelled",
  // "Approved",
];

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
}: SortableStageItemProps) {
  const [inputValue, setInputValue] = useState("");
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

  // const [inputValue, setInputValue] = useState<string>("");
  const inputRef = useRef("");

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
          onValueChange={(value: string) =>
            onStageStatusChange(stage.id, value)
          }
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
            {/* <Input
              value={t.title}
              className="h-7 text-xs w-full mr-2"
              onChange={(e) =>
                  updateSubtask(stage.id.toString(), index, { title: e.target.value })
              }

            />
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 text-destructive"
              onClick={() => removeSubtask(stage.id, index)}
            >
              <Trash2 className="size-4" />
            </Button> */}
            <Input
              value={t.title}
              className="h-7 text-xs w-[45%]"
              onChange={(e) =>
                updateSubtask(stage.id.toString(), index, { title: e.target.value })
              }
            />

            <Input
              type="date"
              value={t.due_date ?? ""}
              className="h-7 text-xs w-[25%]"
              onChange={(e) =>
                updateSubtask(stage.id.toString(), index, { due_date: e.target.value })
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
                {/* <SelectItem value="Blocked">Blocked</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem> */}
              </SelectContent>
            </Select>

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
          onClick={() => {
            addSubtask(stage.id.toString(), ""); // empty new task row
          }}
        >
          <Plus className="size-4" />
          Add task
        </Button>



      </div>
    </div>
  );
}
