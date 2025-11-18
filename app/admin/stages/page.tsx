// app/admin/stages/page.tsx
"use client"

import useSWR from "swr"
import { fetchStagesList, fetchClients } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GripVertical, Plus, Edit2, Trash2 } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function StagesPage() {
  const { data } = useSWR(["stages"], () => fetchStagesList())
  const { data: clients } = useSWR(["clients"], () => fetchClients({ page: 1, pageSize: 100 }))
  const [stages, setStages] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", isRequired: false })
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [subTaskInput, setSubTaskInput] = useState<string>("")
  const [subTasks, setSubTasks] = useState<Record<string, string[]>>({})
  const { toast } = useToast()

  // Sync data to local state
if (data?.data && stages.length === 0) {
    setStages(
      data.data.map((s: any, index: number) => ({
        id: s.stage_id,
        name: s.stage_name,
        isRequired: s.is_required ?? false, // optional
        order: s.order_number ?? index + 1,
      }))
    )
}

  function handleOpenDialog(stage?: any) {
    if (stage) {
      setEditingId(stage.id)
      setFormData({ name: stage.name, isRequired: stage.isRequired })
      setEditOpen(true)
    } else {
      setEditingId(null)
      setFormData({ name: "", isRequired: false })
      setOpen(true)
    }
  }

  function handleSave() {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Stage name is required", variant: "destructive" })
      return
    }

    if (editingId) {
      setStages(
        stages.map((s) => (s.id === editingId ? { ...s, name: formData.name, isRequired: formData.isRequired } : s)),
      )
      toast({ title: "Updated", description: "Stage updated successfully" })
      setEditOpen(false)
    } else {
      const newStage = {
        id: `stage-${Date.now()}`,
        name: formData.name,
        isRequired: formData.isRequired,
        order: stages.length + 1,
      }
      setStages([...stages, newStage])
      toast({ title: "Created", description: "Stage created successfully" })
      setOpen(false)
    }
  }

  function handleDelete(id: string) {
    setStages(stages.filter((s) => s.id !== id))
    setDeleteId(null)
    toast({ title: "Deleted", description: "Stage deleted successfully" })
  }

  function handleAddSubTask(stageId: string) {
    if (!subTaskInput.trim()) {
      toast({ title: "Error", description: "Sub-task cannot be empty", variant: "destructive" })
      return
    }
    setSubTasks({
      ...subTasks,
      [stageId]: [...(subTasks[stageId] || []), subTaskInput],
    })
    setSubTaskInput("")
    toast({ title: "Added", description: "Sub-task added successfully" })
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Stages</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-1 size-4" /> Add Stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stage</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Stage Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., KYC, Accounting Setup"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.isRequired}
                  onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="required" className="cursor-pointer">
                  Required stage
                </Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="client-select">Select Client (Required)</Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger id="client-select">
              <SelectValue placeholder="Choose a client to manage their stages" />
            </SelectTrigger>
            <SelectContent>
              {clients?.data?.map((c: any) => (
                <SelectItem 
                  key={c.client_id} 
                  value={c.client_id.toString()}
                >
                  {c.client_name}
                </SelectItem>

              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClientId && (
          <div className="grid gap-2">
            {stages.map((s) => (
              <div key={s.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="size-4 text-muted-foreground" />
                    <div className="font-medium">{s.name}</div>
                    {s.isRequired && <span className="rounded bg-muted px-2 py-0.5 text-xs">Required</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Order {s.order}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(s)}>
                      <Edit2 className="size-4" />
                    </Button>
                    <AlertDialog open={deleteId === s.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(s.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Stage</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove this stage? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex justify-end gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(s.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="ml-6 mt-2 border-t pt-2">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Sub-Tasks</div>
                  <div className="grid gap-1 mb-2">
                    {(subTasks[s.id] || []).map((task, idx) => (
                      <div key={idx} className="text-sm bg-muted p-1 rounded flex items-center justify-between">
                        <span>• {task}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={() => {
                            setSubTasks({
                              ...subTasks,
                              [s.id]: subTasks[s.id].filter((_, i) => i !== idx),
                            })
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Input
                      size={1}
                      placeholder="Add sub-task..."
                      value={subTaskInput}
                      onChange={(e) => setSubTaskInput(e.target.value)}
                      className="text-xs h-7"
                    />
                    <Button size="sm" variant="outline" onClick={() => handleAddSubTask(s.id)} className="h-7">
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {stages.length > 0 && selectedClientId && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => {
                    const selectedClient = clients?.data?.find((c: any) => c.id === selectedClientId)
                    toast({
                      title: "Success",
                      description: `Stages saved successfully for ${selectedClient?.name || "client"}`,
                    })
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  💾 Save Stages
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Stage Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., KYC, Accounting Setup"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-required"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-required" className="cursor-pointer">
                Required stage
              </Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
