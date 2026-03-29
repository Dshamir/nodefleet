"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  ShieldAlert,
  AlertTriangle,
  Ban,
  Plus,
  Activity,
  Eye,
  Globe,
  Mail,
  User,
} from "lucide-react";

type FraudTab = "overview" | "blocklist" | "rules";

interface FraudEvent {
  id: string;
  type: string;
  severity: string;
  status: string;
  userId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface BlocklistEntry {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SEVERITY_ICON: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-slate-400",
};

export default function FraudDetectionPage() {
  const [tab, setTab] = useState<FraudTab>("overview");
  const [events, setEvents] = useState<FraudEvent[]>([]);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Blocklist add
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"ip" | "user" | "email">("ip");
  const [addValue, setAddValue] = useState("");
  const [addReason, setAddReason] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/security/fraud");
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchBlocklist = useCallback(async () => {
    try {
      const res = await fetch("/api/security/fraud?view=blocklist");
      if (!res.ok) return;
      const data = await res.json();
      setBlocklist(data.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEvents(), fetchBlocklist()]).finally(() =>
      setLoading(false)
    );
  }, [fetchEvents, fetchBlocklist]);

  async function handleAddBlocklist() {
    if (!addValue.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/security/fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addType,
          value: addValue,
          reason: addReason || undefined,
        }),
      });
      if (res.ok) {
        setAddOpen(false);
        setAddValue("");
        setAddReason("");
        fetchBlocklist();
      }
    } catch {
      /* ignore */
    } finally {
      setAdding(false);
    }
  }

  // Stat calculations
  const criticalCount = events.filter(
    (e) => e.severity === "critical"
  ).length;
  const highCount = events.filter((e) => e.severity === "high").length;
  const flaggedCount = events.filter((e) => e.status === "flagged").length;
  const blockedCount = events.filter((e) => e.status === "blocked").length;

  const tabOptions = [
    { value: "overview", label: "Overview", count: events.length },
    { value: "blocklist", label: "Blocklist", count: blocklist.length },
    { value: "rules", label: "Rules" },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Fraud Detection
          </h1>
          <p className="text-slate-400">
            Monitor suspicious activity and manage blocklists
          </p>
        </div>
      </div>

      <FilterTabs
        options={tabOptions}
        value={tab}
        onChange={(v) => setTab(v as FraudTab)}
      />

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-red-400">
                  {criticalCount}
                </p>
                <p className="text-xs text-slate-400 mt-1">Critical</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-orange-400">
                  {highCount}
                </p>
                <p className="text-xs text-slate-400 mt-1">High Severity</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {flaggedCount}
                </p>
                <p className="text-xs text-slate-400 mt-1">Flagged</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-emerald-400">
                  {blockedCount}
                </p>
                <p className="text-xs text-slate-400 mt-1">Blocked</p>
              </CardContent>
            </Card>
          </div>

          {/* Events List */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Recent Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No fraud events detected</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle
                          className={`w-4 h-4 ${SEVERITY_ICON[event.severity] || "text-slate-400"}`}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {event.type}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {event.ipAddress && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Globe className="w-3 h-3" />{" "}
                                {event.ipAddress}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              {timeAgo(event.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={event.severity} />
                        <StatusBadge status={event.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Blocklist Tab */}
      {tab === "blocklist" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              className="bg-primary hover:bg-primary/90 gap-2"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="w-4 h-4" /> Add to Blocklist
            </Button>
          </div>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              {blocklist.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Blocklist is empty</p>
                  <p className="text-xs mt-1">
                    Add IPs, emails, or users to block
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blocklist.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        {entry.type === "ip" && (
                          <Globe className="w-4 h-4 text-cyan-400" />
                        )}
                        {entry.type === "email" && (
                          <Mail className="w-4 h-4 text-blue-400" />
                        )}
                        {entry.type === "user" && (
                          <User className="w-4 h-4 text-purple-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white font-mono">
                            {entry.value}
                          </p>
                          {entry.reason && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {entry.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize bg-slate-800"
                        >
                          {entry.type}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {timeAgo(entry.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rules Tab */}
      {tab === "rules" && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Detection Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  name: "Brute Force Login",
                  desc: "Flag after 10 failed login attempts in 5 minutes",
                  active: true,
                },
                {
                  name: "Impossible Travel",
                  desc: "Detect logins from geographically distant IPs in short time",
                  active: true,
                },
                {
                  name: "Suspicious API Usage",
                  desc: "Alert on abnormal API request patterns",
                  active: true,
                },
                {
                  name: "New Device Alert",
                  desc: "Notify when login from unrecognized device",
                  active: false,
                },
                {
                  name: "Credential Stuffing",
                  desc: "Detect automated login attempts with known breach data",
                  active: true,
                },
                {
                  name: "Session Hijacking",
                  desc: "Flag when session token used from different IP",
                  active: false,
                },
              ].map((rule) => (
                <div
                  key={rule.name}
                  className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-800"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {rule.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {rule.desc}
                    </p>
                  </div>
                  <StatusBadge
                    status={rule.active ? "active" : "disabled"}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add to Blocklist Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle>Add to Blocklist</DialogTitle>
            <DialogDescription>
              Block an IP address, email, or user from accessing the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Type
              </label>
              <div className="flex gap-2">
                {(["ip", "user", "email"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAddType(t)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                      addType === t
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Value
              </label>
              <Input
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder={
                  addType === "ip"
                    ? "192.168.1.1"
                    : addType === "email"
                      ? "spam@example.com"
                      : "user-id"
                }
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reason (optional)
              </label>
              <Input
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="Why is this being blocked?"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 gap-2"
                onClick={handleAddBlocklist}
                disabled={adding || !addValue.trim()}
              >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                <Ban className="w-4 h-4" /> Block
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
