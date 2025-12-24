"use client"

import { useParams } from "next/navigation"
import useSWR, { mutate } from "swr"
import { fetchClient, fetchTasks, fetchMessages } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Building2, Mail, Phone, Calendar, User, Send, Reply, X, FileText, Loader2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"

interface Message {
  id: string | number;
  senderRole: string;
  body: string;
  createdAt: string;
  parentMessageId?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

export default function ServiceCenterClientWorkspace() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const { data: client } = useSWR(["client", id], () => fetchClient(id))
  const { data: allTasks, mutate: refreshTasks } = useSWR(["tasks", id], () => fetchTasks({ clientId: id }))
  const { data: msgsResponse } = useSWR(["msgs", id], () => fetchMessages({ clientId: id }))

  // Message states
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState("")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [isSending, setIsSending] = useState(false)

  // Sync messages
  useEffect(() => {
    if (Array.isArray(msgsResponse?.data)) {
      setMessages(
        msgsResponse.data.map((m: any) => ({
          id: m.message_id,
          senderRole: m.sender_role,
          body: m.body,
          parentMessageId: m.parent_message_id,
          attachmentUrl: m.attachment_url,
          attachmentName: m.attachment_name,
          createdAt: m.created_at,
        }))
      )
    }
  }, [msgsResponse])

  // Filter tasks to only show those assigned to SERVICE_CENTER
  const serviceCenterTasks = (allTasks?.data || []).filter(
    (task: any) => task.assigneeRole === "SERVICE_CENTER"
  )

  // Update task status
  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: newStatus }),
      })

      if (res.ok) {
        toast({ title: "Status Updated", description: `Task status changed to ${newStatus}` })
        refreshTasks()
        mutate(["sc-all-tasks"])
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    }
  }

  // Send message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !id) return

    setIsSending(true)
    try {
      await fetch("/api/messages/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: id,
          sender_role: "SERVICE_CENTER",
          receiver_role: "ADMIN",
          body: messageText,
          parent_message_id: replyingTo?.id,
        }),
      })

      setMessageText("")
      setReplyingTo(null)
      toast({ title: "Message sent" })
      mutate(["msgs", id])
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Client Header */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{client?.client_name || client?.name || "Loading..."}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                {client?.primary_contact_name && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {client.primary_contact_name}
                  </span>
                )}
                {(client?.primary_contact_email || client?.email) && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {client.primary_contact_email || client.email}
                  </span>
                )}
                {client?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    {client.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="tasks" className="data-[state=active]:bg-background">
            My Tasks ({serviceCenterTasks.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="data-[state=active]:bg-background">
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Tasks Assigned to You</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceCenterTasks.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No tasks assigned to you for this client
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Client</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Due Date</th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {serviceCenterTasks.map((task: any) => (
                        <tr key={task.id} className="group">
                          <td className="py-4 pr-4">
                            <span className="text-sm font-medium">{task.title}</span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="text-sm text-muted-foreground">{client?.client_name || client?.name}</span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                            </span>
                          </td>
                          <td className="py-4">
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Not Started">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                                    Not Started
                                  </span>
                                </SelectItem>
                                <SelectItem value="In Progress">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                                    In Progress
                                  </span>
                                </SelectItem>
                                <SelectItem value="Completed">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                    Completed
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <Card className="flex flex-col h-[500px]">
            <CardHeader className="border-b px-4 py-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Messages</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Communication with {client?.client_name || "this client"}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50">
              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
                    <div className="bg-slate-200 p-4 rounded-full">
                      <Send className="size-6 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">No messages yet</p>
                      <p className="text-sm text-slate-500">Start the conversation by sending a message.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((m, index) => {
                    const isMe = m.senderRole === "SERVICE_CENTER"
                    return (
                      <div
                        key={`${m.id}-${index}`}
                        className={`group flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                          <div className="flex items-end gap-2">
                            {/* Avatar for others */}
                            {!isMe && (
                              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold border border-violet-200 shrink-0">
                                {m.senderRole === "ADMIN" ? "AD" : "CL"}
                              </div>
                            )}

                            {/* Message Bubble */}
                            <div
                              className={`relative px-4 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${isMe
                                ? "bg-blue-500 text-white rounded-br-none"
                                : "bg-white text-slate-700 rounded-bl-none border"
                                }`}
                            >
                              {/* Reply Reference */}
                              {m.parentMessageId && (() => {
                                const parentMsg = messages.find(msg => msg.id === m.parentMessageId)
                                if (parentMsg) {
                                  return (
                                    <div className={`mb-2 p-2 rounded-lg text-xs border-l-2 ${isMe ? "bg-blue-600/50 border-blue-300" : "bg-slate-100 border-slate-300"}`}>
                                      <span className={`font-semibold ${isMe ? "text-blue-100" : "text-slate-500"}`}>
                                        {parentMsg.senderRole === "SERVICE_CENTER" ? "You" : parentMsg.senderRole}
                                      </span>
                                      <p className={`truncate ${isMe ? "text-blue-100" : "text-slate-600"}`}>{parentMsg.body}</p>
                                    </div>
                                  )
                                }
                                return null
                              })()}

                              {m.body}

                              {/* Attachment Display */}
                              {m.attachmentUrl && m.attachmentName && (
                                <a
                                  href={m.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 mt-2 p-2 rounded-lg ${isMe ? "bg-blue-600/50 hover:bg-blue-600/70" : "bg-slate-100 hover:bg-slate-200"} transition-colors`}
                                >
                                  <FileText className={`size-4 ${isMe ? "text-blue-100" : "text-slate-500"}`} />
                                  <span className={`text-xs underline ${isMe ? "text-blue-100" : "text-slate-600"}`}>
                                    {m.attachmentName}
                                  </span>
                                </a>
                              )}

                              {/* Timestamp */}
                              <div className={`text-[10px] mt-1 opacity-70 ${isMe ? "text-blue-100 text-right" : "text-slate-400"}`}>
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>

                            {/* Reply Button */}
                            <button
                              onClick={() => setReplyingTo(m)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-slate-200 text-slate-500"
                              title="Reply"
                            >
                              <Reply className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Input Area */}
              <div className="border-t bg-white p-3 shrink-0">
                {/* Reply Banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between bg-blue-50 border-l-4 border-blue-500 p-2 mb-2 rounded-r text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-blue-600">
                        Replying to {replyingTo.senderRole === "SERVICE_CENTER" ? "Yourself" : replyingTo.senderRole}
                      </span>
                      <span className="text-slate-600 truncate max-w-xs">{replyingTo.body}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-blue-100 rounded-full">
                      <X className="size-4 text-blue-500" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2 bg-slate-100 p-2 rounded-xl border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all">
                  <textarea
                    placeholder="Type a message..."
                    className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 px-2 py-2 min-h-[40px] max-h-32 resize-none text-sm"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    rows={1}
                    disabled={isSending}
                  />

                  <Button
                    onClick={handleSendMessage}
                    size="icon"
                    className={`h-9 w-9 rounded-full shrink-0 transition-all ${messageText.trim() ? "bg-blue-500 hover:bg-blue-600" : "bg-slate-300 hover:bg-slate-400"}`}
                    disabled={!messageText.trim() || isSending}
                  >
                    {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
                <div className="text-[10px] text-slate-400 text-center mt-2">
                  Enter to send, Shift + Enter for new line
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
