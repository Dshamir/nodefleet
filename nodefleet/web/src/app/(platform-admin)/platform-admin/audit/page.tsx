"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  orgId: string | null;
  userId: string | null;
  deviceId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

const actionColors: Record<string, string> = {
  device_created: "text-green-400",
  device_deleted: "text-red-400",
  device_updated: "text-blue-400",
  device_paired: "text-cyan-400",
  device_connected: "text-emerald-400",
  device_disconnected: "text-orange-400",
  command_sent: "text-yellow-400",
  command_completed: "text-green-400",
  command_failed: "text-red-400",
  user_login: "text-blue-400",
  user_logout: "text-slate-400",
  settings_changed: "text-purple-400",
  alert_triggered: "text-red-400",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setLogs(json.data);
      setPagination(json.pagination);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-red-400" />
          Global Audit Log
        </h1>
        <p className="text-slate-400 mt-1">
          Platform-wide audit trail across all organizations ({pagination.total} entries)
        </p>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Entity Type</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Org ID</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">User ID</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">IP Address</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-800 rounded animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`text-sm font-mono font-medium ${actionColors[log.action] || "text-slate-300"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {log.entityType || "-"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {log.orgId ? log.orgId.slice(0, 8) + "..." : "-"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {log.userId ? log.userId.slice(0, 8) + "..." : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {log.ipAddress || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchLogs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fetchLogs(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                  className="p-1.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
