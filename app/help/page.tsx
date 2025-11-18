"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const help = {
  ADMIN: ["Create a client", "Assign Service Center and CPA", "Set initial stage or tasks"],
  CLIENT: ["Check Inbox and Tasks", "Upload required documents", "Ask a question if blocked"],
  SERVICE_CENTER: ["Review client uploads", "Assign tasks to client", "Leave feedback notes"],
  CPA: ["Review documents", "Set stage for assigned clients", "Create CPA tasks"],
}

export default function HelpPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(help).map(([role, steps]) => (
        <Card key={role}>
          <CardHeader>
            <CardTitle>{role} — Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {steps.map((s, i) => (
              <div key={i}>• {s}</div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
