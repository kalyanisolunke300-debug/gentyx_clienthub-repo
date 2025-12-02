// app/admin/email-templates/page.tsx
"use client"

import useSWR, { mutate } from "swr"
// import { fetchEmailTemplates } from "@/lib/api"
import { fetchEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit2, Trash2, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function EmailTemplatesPage() {
  const { data } = useSWR(["templates"], () => fetchEmailTemplates())
  const [templates, setTemplates] = React.useState<any[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState({ name: "", subject: "", body: "" })
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false);

  // Sync data to local state
  React.useEffect(() => {
    if (data) {
      setTemplates(data);

      // 🔥 Ensure selected template updates too
      if (selected) {
        const updated = data.find((t: any) => t.id === selected);
        if (updated) setSelected(updated.id);
      }
    }
  }, [data]);


  const tpl = templates.find((t) => t.id === selected)

  function handleOpenDialog(template?: any) {
    if (template) {
      setEditingId(template.id)
      setFormData({ name: template.name, subject: template.subject, body: template.body })
    } else {
      setEditingId(null)
      setFormData({ name: "", subject: "", body: "" })
    }
    setOpen(true)
  }

async function handleSave() {
  if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
    toast({ title: "Error", description: "All fields are required", variant: "destructive" });
    return;
  }

  try {
    setIsSaving(true); // 🔥 Disable button

    if (editingId) {
      await updateEmailTemplate({
        id: Number(editingId),   // 🔥 FIX HERE
        ...formData
      });
      toast({ title: "Updated", description: "Template updated successfully" });
    } else {
      await createEmailTemplate(formData);
      toast({ title: "Created", description: "Template created successfully" });
    }

    mutate(["templates"]); // refresh list
    setOpen(false);

  } finally {
    setIsSaving(false); // re-enable button
  }
}

 
  async function handleDelete(id: number) {
    await deleteEmailTemplate(id);
    toast({ title: "Deleted", description: "Template deleted successfully" });
    setSelected(null);
  }
  function handleUploadTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".html") && !file.name.endsWith(".txt")) {
      toast({ title: "Error", description: "Only .html and .txt files are supported", variant: "destructive" })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const templateName = file.name.replace(/\.(html|txt)$/, "")
      const newTemplate = {
        id: `tpl-${Date.now()}`,
        name: templateName,
        subject: "Imported Template",
        body: content,
        isDefault: false,
      }
      setTemplates([...templates, newTemplate])
      toast({ title: "Uploaded", description: `Template "${templateName}" imported successfully` })
      setUploadOpen(false)
    }
    reader.readAsText(file)
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Templates</CardTitle>
          <div className="flex gap-1">
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" title="Upload template">
                  <Upload className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Email Template</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <p className="text-sm text-muted-foreground">Upload .html or .txt email templates</p>
                  <Input type="file" accept=".html,.txt" onChange={handleUploadTemplate} className="cursor-pointer" />
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit" : "Add New"} Template</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="tpl-name">Template Name</Label>
                    <Input
                      id="tpl-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., New Task Assigned"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tpl-subject">Subject</Label>
                    <Input
                      id="tpl-subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Email subject"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tpl-body">Body</Label>
                    <Textarea
                      id="tpl-body"
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      placeholder="Email body"
                      rows={6}
                    />
                  </div>
                  <div className="rounded-md border p-2 text-xs text-muted-foreground">
                    <strong>Variables:</strong> {"{{clientName}} {{taskTitle}} {{dueDate}} {{stageName}}"}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Updating..." : editingId ? "Update" : "Create"}
                      </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              className="rounded-md border px-2 py-2 text-left hover:bg-muted transition-colors"
              onClick={() => setSelected(t.id)}
            >
              <div className="font-medium text-sm">{t.name}</div>
              {t.isDefault && <div className="text-xs text-muted-foreground">Default</div>}
            </button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Editor</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Preview
            </Button>
            {tpl && (
              <>
                <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(tpl)}>
                  <Edit2 className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(tpl.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {tpl ? (
            <>
              <div className="grid gap-2">
                <Label>Subject</Label>
                <Input value={tpl.subject} readOnly />
              </div>
              <div className="grid gap-2">
                <Label>Body</Label>
                <Textarea value={tpl.body} readOnly rows={8} />
              </div>
              <div className="rounded-md border p-2 text-sm text-muted-foreground">
                Variables: {"{{clientName}} {{taskTitle}} {{dueDate}} {{stageName}}"}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Select a template to view</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
