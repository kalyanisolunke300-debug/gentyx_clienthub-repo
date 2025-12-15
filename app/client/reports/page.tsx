"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ClientReports() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Daily/Weekly/Monthly reports from Service Center will appear here.
      </CardContent>
    </Card>
  )
}
