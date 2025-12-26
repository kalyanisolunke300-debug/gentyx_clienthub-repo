"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useUIStore } from "@/store/ui-store"
import { Pencil, Plus, X, Save, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type HelpData = Record<string, string[]>

const roleLabels: Record<string, string> = {
  ADMIN: "ADMIN",
  CLIENT: "CLIENT",
  SERVICE_CENTER: "SERVICE_CENTER",
  CPA: "CPA",
}

export default function HelpPage() {
  const [helpData, setHelpData] = useState<HelpData>({})
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<HelpData>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Get role from UI store (same as other pages)
  const role = useUIStore((s) => s.role)

  // Load help data
  useEffect(() => {
    async function loadHelp() {
      try {
        const res = await fetch("/api/help/get")
        const json = await res.json()
        if (json.success) {
          setHelpData(json.data)
          setEditData(json.data)
        }
      } catch (err) {
        console.error("Failed to load help content:", err)
      } finally {
        setLoading(false)
      }
    }
    loadHelp()
  }, [])

  const isAdmin = role === "ADMIN"

  // Add a new step to a role
  function addStep(roleName: string) {
    setEditData(prev => ({
      ...prev,
      [roleName]: [...(prev[roleName] || []), ""]
    }))
  }

  // Update a step
  function updateStep(roleName: string, index: number, value: string) {
    setEditData(prev => ({
      ...prev,
      [roleName]: prev[roleName].map((s, i) => i === index ? value : s)
    }))
  }

  // Remove a step
  function removeStep(roleName: string, index: number) {
    setEditData(prev => ({
      ...prev,
      [roleName]: prev[roleName].filter((_, i) => i !== index)
    }))
  }

  // Save changes
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/help/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpData: editData }),
      })

      const json = await res.json()

      if (!json.success) {
        toast({
          title: "Error",
          description: json.error || "Failed to save help content",
          variant: "destructive",
        })
        return
      }

      setHelpData(editData)
      setIsEditing(false)
      toast({
        title: "Updated",
        description: "Help content updated successfully",
        variant: "success",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save help content",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Cancel editing
  function handleCancel() {
    setEditData(helpData)
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Help & Getting Started</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quick reference guides for each role
          </p>
        </div>

        {isAdmin && !isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Help Content
          </Button>
        )}
      </div>

      {/* Help Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(helpData).map(([roleName, steps]) => (
          <Card key={roleName} className="relative">
            <CardHeader>
              <CardTitle>{roleLabels[roleName] || roleName} — Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{s}</span>
                </div>
              ))}
              {steps.length === 0 && (
                <div className="text-muted-foreground italic">No help items yet</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Help Content</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {Object.entries(editData).map(([roleName, steps]) => (
              <div key={roleName} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">
                  {roleLabels[roleName] || roleName} — Getting Started
                </h3>

                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-muted-foreground">•</span>
                      <Input
                        value={step}
                        onChange={(e) => updateStep(roleName, index, e.target.value)}
                        placeholder="Enter help step..."
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(roleName, index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => addStep(roleName)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Step
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
