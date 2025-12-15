"use client"

import useSWR from "swr"
import { fetchAuditLogs } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const { data: audits } = useSWR(["audits"], () => fetchAuditLogs())

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Name" defaultValue="Admin User" />
          <Input placeholder="Email" defaultValue="admin@mail.com" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between">
            <Label>Email Alerts</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Task Updates</Label>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credentials Vault (Stub)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Input placeholder="Enter secret (one-time visibility)" />
          <div className="text-xs text-destructive">Warning: Secrets are only visible once on submission.</div>
          <div className="flex justify-end">
            <Button>Submit Secret</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {(audits || []).map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border p-2">
              <div>{a.action}</div>
              <div className="text-muted-foreground">
                {a.actorRole} • {new Date(a.at).toLocaleString()}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
