"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, RefreshCw } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  userId: string | null;
  deviceId: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  device_created: "bg-emerald-500/20 text-emerald-400",
  device_connected: "bg-green-500/20 text-green-400",
  device_disconnected: "bg-red-500/20 text-red-400",
  command_sent: "bg-blue-500/20 text-blue-400",
  command_completed: "bg-emerald-500/20 text-emerald-400",
  command_failed: "bg-red-500/20 text-red-400",
  command_timeout: "bg-yellow-500/20 text-yellow-400",
  settings_changed: "bg-purple-500/20 text-purple-400",
  user_login: "bg-cyan-500/20 text-cyan-400",
  factory_reset: "bg-red-500/20 text-red-400",
  firmware_updated: "bg-orange-500/20 text-orange-400",
  media_uploaded: "bg-indigo-500/20 text-indigo-400",
};

const RANGES = [
  { label: "1 Hour", value: "1h" },
  { label: "6 Hours", value: "6h" },
  { label: "24 Hours", value: "24h" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");
  const [actionFilter, setActionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/api/audit?range=${range}&limit=${limit}&offset=${offset}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [range, actionFilter, offset]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-slate-400" />
          <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
          <Badge variant="secondary" className="text-xs">{total} events</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={range} onValueChange={(v) => { setRange(v); setOffset(0); }}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-700">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setOffset(0); }}>
          <SelectTrigger className="w-48 bg-slate-900 border-slate-700">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="device_connected">Device Connected</SelectItem>
            <SelectItem value="device_disconnected">Device Disconnected</SelectItem>
            <SelectItem value="command_sent">Command Sent</SelectItem>
            <SelectItem value="command_completed">Command Completed</SelectItem>
            <SelectItem value="command_failed">Command Failed</SelectItem>
            <SelectItem value="settings_changed">Settings Changed</SelectItem>
            <SelectItem value="device_created">Device Created</SelectItem>
            <SelectItem value="factory_reset">Factory Reset</SelectItem>
            <SelectItem value="media_uploaded">Media Uploaded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400 w-44">Timestamp</TableHead>
                <TableHead className="text-slate-400 w-44">Action</TableHead>
                <TableHead className="text-slate-400">Details</TableHead>
                <TableHead className="text-slate-400 w-32">Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    No audit events found for this range
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell className="text-xs text-slate-400 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || "bg-slate-700 text-slate-300"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 max-w-md truncate">
                    {log.details ? JSON.stringify(log.details).slice(0, 120) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 font-mono">
                    {log.deviceId ? log.deviceId.slice(0, 8) + "..." : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
