"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  MessageSquare,
  Search,
  Loader2,
  AlertCircle,
  Send,
  User,
  Bot,
  ShieldCheck,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Conversation {
  id: string;
  customerId: string | null;
  status: string;
  lastMessage: string | null;
  assignedTo: string | null;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  body: string;
  senderType: "customer" | "ai" | "admin";
  senderId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const SENDER_ICONS: Record<string, React.ReactNode> = {
  customer: <User className="w-4 h-4" />,
  ai: <Bot className="w-4 h-4" />,
  admin: <ShieldCheck className="w-4 h-4" />,
};

const SENDER_COLORS: Record<string, string> = {
  customer: "bg-blue-500/20 text-blue-400",
  ai: "bg-purple-500/20 text-purple-400",
  admin: "bg-green-500/20 text-green-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatManagementPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/content/chat?${params}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const json = await res.json();
      setConversations(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      setMessagesLoading(true);
      const res = await fetch(`/api/content/chat?conversationId=${convId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const json = await res.json();
      setMessages(json.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  function selectConversation(conv: Conversation) {
    setSelectedConv(conv);
    setMessages([]);
    fetchMessages(conv.id);
  }

  async function handleSendReply() {
    if (!replyText.trim() || !selectedConv) return;
    try {
      setSending(true);
      const res = await fetch("/api/content/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          body: replyText,
          senderType: "admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setReplyText("");
      await fetchMessages(selectedConv.id);
      await fetchConversations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const filteredConversations = conversations;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Chat Management</h1>
        <p className="text-slate-400">
          Monitor and respond to customer conversations
        </p>
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "calc(100vh - 280px)" }}>
        {/* Left Panel — Conversation List */}
        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-1 flex flex-col">
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700"
              />
            </div>
            <div className="flex gap-1.5">
              {["all", "open", "in_progress", "resolved"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs ${
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {s === "all" ? "All" : s.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {!loading && filteredConversations.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400 text-sm">No conversations found</p>
              </div>
            )}

            {!loading &&
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${
                    selectedConv?.id === conv.id ? "bg-slate-800/70" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white truncate">
                      {conv.customerId
                        ? `Customer ${conv.customerId.substring(0, 8)}...`
                        : "Anonymous"}
                    </span>
                    <StatusBadge status={conv.status} />
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {conv.lastMessage || "No messages yet"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatRelative(conv.updatedAt)}
                  </p>
                  {conv.needsReview && (
                    <Badge className="mt-1 text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Needs Review
                    </Badge>
                  )}
                </button>
              ))}
          </div>
        </Card>

        {/* Right Panel — Message Thread */}
        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-2 flex flex-col">
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">
                  Select a conversation to view messages
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedConv.customerId
                      ? `Customer ${selectedConv.customerId.substring(0, 8)}...`
                      : "Anonymous Conversation"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedConv.status} />
                    <span className="text-xs text-slate-500">
                      Started {formatRelative(selectedConv.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messagesLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                {!messagesLoading && messages.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-500 text-sm">
                      No messages in this conversation yet
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.senderType === "admin" ? "justify-end" : ""
                    }`}
                  >
                    {msg.senderType !== "admin" && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          SENDER_COLORS[msg.senderType]
                        }`}
                      >
                        {SENDER_ICONS[msg.senderType]}
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.senderType === "admin"
                          ? "bg-primary/20 text-white"
                          : msg.senderType === "ai"
                          ? "bg-purple-500/10 text-slate-200"
                          : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium capitalize text-slate-400">
                          {msg.senderType}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    </div>
                    {msg.senderType === "admin" && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${SENDER_COLORS.admin}`}
                      >
                        {SENDER_ICONS.admin}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div className="px-6 py-4 border-t border-slate-800">
                <div className="flex items-center gap-3">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a reply..."
                    className="flex-1 bg-slate-800 border-slate-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                    className="gap-2"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
