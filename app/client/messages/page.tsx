"use client"

import useSWR from "swr"
import { fetchMessages } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

export default function ClientMessages() {
  const { data } = useSWR(["msgs"], () => fetchMessages())
  const [messages, setMessages] = useState<any[]>([])
  const [messageInput, setMessageInput] = useState("")
  const { toast } = useToast()

  // Sync data to local state
  if (data && messages.length === 0) {
    setMessages(data)
  }

  function handleSendMessage() {
    if (!messageInput.trim()) {
      toast({ title: "Error", description: "Message cannot be empty", variant: "destructive" })
      return
    }

    const newMessage = {
      id: `msg-${Date.now()}`,
      threadId: "thr-1",
      participants: [
        { role: "CLIENT", display: "You" },
        { role: "ADMIN", display: "Admin" },
      ],
      senderRole: "CLIENT",
      body: messageInput,
      createdAt: new Date().toISOString(),
    }

    setMessages([...messages, newMessage])
    setMessageInput("")
    toast({ title: "Sent", description: "Your message has been sent" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2 max-h-96 overflow-y-auto">
          {(messages || []).map((m) => (
            <div key={m.id} className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">
                {m.senderRole} • {new Date(m.createdAt).toLocaleString()}
              </div>
              <div>{m.body}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t pt-3">
          <Input
            placeholder="Type a message…"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <Button onClick={handleSendMessage}>Send</Button>
        </div>
      </CardContent>
    </Card>
  )
}
