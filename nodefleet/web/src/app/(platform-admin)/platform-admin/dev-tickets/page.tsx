"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface DevTicket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  labels: string[] | null;
  createdAt: string;
}

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-green-500/20 text-green-400",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-cyan-500/20 text-cyan-400",
  review: "bg-purple-500/20 text-purple-400",
  done: "bg-green-500/20 text-green-400",
  closed: "bg-slate-500/20 text-slate-400",
};

export default function DevTicketsPage() {
  const [tickets, setTickets] = useState<DevTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/dev/tickets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setTickets(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" /> Dev Tickets
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} total tickets</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "open", "in_progress", "review", "done", "closed"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className="capitalize"
          >
            {s.replace("_", " ")}
          </Button>
        ))}
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Title</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Status</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Priority</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Labels</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-48 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-24 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500 py-12">
                      <Ticket className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                      <p>No tickets found</p>
                      <p className="text-xs mt-1">Create a ticket to start tracking development work.</p>
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4">
                        <p className="text-sm text-white font-medium">{ticket.title}</p>
                        {ticket.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{ticket.description}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge className={`capitalize ${statusColors[ticket.status] || "bg-slate-500/20 text-slate-400"}`}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={`capitalize ${priorityColors[ticket.priority] || "bg-slate-500/20 text-slate-400"}`}>
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap">
                          {ticket.labels?.map((label) => (
                            <span key={label} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <div className="flex items-center justify-between p-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / limit)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
