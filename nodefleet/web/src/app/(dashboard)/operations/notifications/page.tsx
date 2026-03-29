"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, RefreshCw, CheckCheck, Info, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";

interface Notification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchNotifications = () => {
    setLoading(true);
    fetch("/api/notifications?limit=50")
      .then((r) => r.json())
      .then((res) => {
        setNotifications(res.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount} unread</Badge>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            System alerts, warnings, and operational notices.
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <CheckCheck className="w-3 h-3 mr-1" /> Mark All Read
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={fetchNotifications} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="animate-pulse flex gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-48" />
                    <div className="h-3 bg-slate-800 rounded w-96" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-12 text-center">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No notifications yet.</p>
            <p className="text-slate-500 text-sm mt-1">
              You will see system alerts and operational notices here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const Icon = config.icon;
            return (
              <Card
                key={n.id}
                className={`border transition-colors cursor-pointer ${
                  n.read
                    ? "bg-slate-900/30 border-slate-800/50"
                    : "bg-slate-900/50 border-slate-800"
                }`}
                onClick={() => !n.read && markRead(n.id)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`p-2 rounded-full ${config.bg}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${n.read ? "text-slate-400" : "text-white"}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{n.body}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
