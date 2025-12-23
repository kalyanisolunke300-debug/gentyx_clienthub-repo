// app/client/messages/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import useSWR, { mutate } from "swr";
import { fetchMessages } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/store/ui-store";
import { Send, Reply, Paperclip, Smile, X, FileText, Loader2 } from "lucide-react";

// --- TYPES ---
interface ClientMessage {
  id: string | number;
  senderRole: string;
  body: string;
  createdAt: string;
  parentMessageId?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

export default function ClientMessages() {
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<ClientMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Attachment states
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Common emojis for quick selection
  const commonEmojis = [
    "😊", "😂", "❤️", "👍", "🎉", "🔥", "✨", "💯",
    "😍", "🤔", "👏", "🙌", "💪", "🚀", "✅", "⭐",
    "😎", "🥳", "😇", "🤝", "📧", "📞", "💼", "📄"
  ];

  // Wait for client context from login
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId);
    }
  }, [role, currentClientId]);

  // Fetch messages for this client
  const { data: msgsResponse, isLoading } = useSWR(
    clientId ? ["msgs", clientId] : null,
    () => fetchMessages({ clientId: clientId! }),
    { revalidateOnFocus: false }
  );

  // Sync messages to local state
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
      );
    } else {
      setMessages([]);
    }
  }, [msgsResponse]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
        return;
      }
      setAttachmentFile(file);
    }
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !attachmentFile) || !clientId) return;

    setIsUploading(true);

    try {
      let attachmentUrl = null;
      let attachmentName = null;

      // Upload attachment if exists
      if (attachmentFile) {
        const formData = new FormData();
        formData.append("clientId", clientId);
        formData.append("file", attachmentFile);

        const uploadRes = await fetch("/api/messages/upload-attachment", {
          method: "POST",
          body: formData,
        });

        const uploadJson = await uploadRes.json();

        if (!uploadJson.success) {
          toast({ title: "Failed to upload attachment", variant: "destructive" });
          setIsUploading(false);
          return;
        }

        attachmentUrl = uploadJson.attachmentUrl;
        attachmentName = uploadJson.attachmentName;
      }

      // Send message with attachment info
      await fetch("/api/messages/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          sender_role: "CLIENT",
          receiver_role: "ADMIN",
          body: messageText || (attachmentFile ? `Sent an attachment: ${attachmentFile.name}` : ""),
          parent_message_id: replyingTo?.id,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        }),
      });

      setMessageText("");
      setAttachmentFile(null);
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Message sent" });

      mutate(["msgs", clientId]); // refresh messages
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Messages</CardTitle>
              <p className="text-xs text-muted-foreground">
                Direct communication with your administrator
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50">

          {/* MESSAGES LIST */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
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
                const isMe = m.senderRole === "CLIENT";
                return (
                  <div
                    key={`${m.id}-${index}`}
                    className={`group flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>

                      <div className="flex items-end gap-2">
                        {/* Admin Avatar */}
                        {!isMe && (
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold border border-violet-200 shrink-0">
                            AD
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`relative px-4 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${isMe
                            ? "bg-violet-400 text-white rounded-br-none"
                            : "bg-slate-100 text-slate-700 rounded-bl-none"
                            }`}
                        >
                          {/* Reply Reference */}
                          {m.parentMessageId && (() => {
                            const parentMsg = messages.find(msg => msg.id === m.parentMessageId);
                            if (parentMsg) {
                              return (
                                <div className={`mb-2 p-2 rounded-lg text-xs border-l-2 ${isMe ? "bg-violet-500/50 border-violet-300" : "bg-white border-slate-300"}`}>
                                  <span className={`font-semibold ${isMe ? "text-violet-100" : "text-slate-500"}`}>
                                    {parentMsg.senderRole === "CLIENT" ? "You" : "Admin"}
                                  </span>
                                  <p className={`truncate ${isMe ? "text-violet-100" : "text-slate-600"}`}>{parentMsg.body}</p>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {m.body}

                          {/* Attachment Display */}
                          {m.attachmentUrl && m.attachmentName && (() => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m.attachmentName);

                            if (isImage) {
                              return (
                                <a
                                  href={m.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block mt-2"
                                >
                                  <img
                                    src={m.attachmentUrl}
                                    alt={m.attachmentName}
                                    className="max-w-[250px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  />
                                </a>
                              );
                            }

                            return (
                              <a
                                href={m.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 mt-2 p-2 rounded-lg ${isMe ? "bg-violet-500/50 hover:bg-violet-500/70" : "bg-white hover:bg-slate-50"} transition-colors`}
                              >
                                <FileText className={`size-4 ${isMe ? "text-violet-100" : "text-slate-500"}`} />
                                <span className={`text-xs underline ${isMe ? "text-violet-100" : "text-slate-600"}`}>
                                  {m.attachmentName}
                                </span>
                              </a>
                            );
                          })()}

                          {/* Timestamp */}
                          <div className={`text-[10px] mt-1 opacity-70 ${isMe ? "text-violet-100 text-right" : "text-slate-400"}`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* Reply Button (Hover) */}
                        <button
                          onClick={() => setReplyingTo(m)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-slate-200 text-slate-500"
                          title="Reply to this message"
                        >
                          <Reply className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* INPUT AREA */}
          <div className="border-t bg-white p-3">
            {/* Reply Banner */}
            {replyingTo && (
              <div className="flex items-center justify-between bg-blue-50 border-l-4 border-blue-500 p-2 mb-2 rounded-r text-sm">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-blue-600">Replying to {replyingTo.senderRole === "CLIENT" ? "Yourself" : "Admin"}</span>
                  <span className="text-slate-600 truncate max-w-xs">{replyingTo.body}</span>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-blue-100 rounded-full">
                  <X className="size-4 text-blue-500" />
                </button>
              </div>
            )}

            {/* Attachment Preview */}
            {attachmentFile && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-2 mb-2 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-amber-600" />
                  <span className="text-amber-800 truncate max-w-xs">{attachmentFile.name}</span>
                  <span className="text-amber-600 text-xs">({(attachmentFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={() => {
                    setAttachmentFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="p-1 hover:bg-amber-100 rounded-full"
                >
                  <X className="size-4 text-amber-600" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 bg-slate-100 p-2 rounded-xl border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all">

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt"
              />

              {/* Attachment Button */}
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-full shrink-0 ${attachmentFile ? "text-amber-600 bg-amber-50" : ""}`}
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Paperclip className="size-5" />
              </Button>

              {/* Emoji Button */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 text-slate-500 hover:text-amber-500 hover:bg-amber-50 rounded-full shrink-0 ${showEmojiPicker ? "text-amber-500 bg-amber-50" : ""}`}
                  title="Add emoji"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile className="size-5" />
                </Button>

                {/* Emoji Picker Dropdown */}
                {showEmojiPicker && (
                  <div className="absolute bottom-12 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 w-64 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">Pick an emoji</span>
                      <button
                        onClick={() => setShowEmojiPicker(false)}
                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {commonEmojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setMessageText((prev) => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="text-xl p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <textarea
                placeholder="Type a message..."
                className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 px-2 py-2 min-h-[40px] max-h-32 resize-none text-sm"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                disabled={isUploading}
              />

              <Button
                onClick={handleSendMessage}
                size="icon"
                className={`h-9 w-9 rounded-full shrink-0 transition-all ${(messageText.trim() || attachmentFile) ? "bg-violet-500 hover:bg-violet-600" : "bg-slate-300 hover:bg-slate-400"}`}
                disabled={(!messageText.trim() && !attachmentFile) || isUploading}
              >
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <div className="text-[10px] text-slate-400 text-center mt-2">
              Enter to send, Shift + Enter for new line
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
