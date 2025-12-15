"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ClientProfile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input placeholder="Company Name" defaultValue="Client LLC" />
        <Input placeholder="Contact Name" defaultValue="John Smith" />
        <Input placeholder="Email" defaultValue="client@mail.com" />
        <div className="flex justify-end">
          <Button>Save</Button>
        </div>
      </CardContent>
    </Card>
  )
}
