"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  status: string;
  score: number;
  source: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  contacted: "bg-cyan-500/20 text-cyan-400",
  qualified: "bg-green-500/20 text-green-400",
  proposal: "bg-purple-500/20 text-purple-400",
  negotiation: "bg-amber-500/20 text-amber-400",
  won: "bg-emerald-500/20 text-emerald-400",
  lost: "bg-red-500/20 text-red-400",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/crm/leads?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" /> Leads
        </h1>
        <p className="text-slate-400 text-sm mt-1">{total} total leads</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Name</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Email</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Status</th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4">Score</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Source</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-28 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-36 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-12 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No leads yet</p>
                      <p className="text-slate-500 text-sm mt-1">Leads will appear here as they are captured.</p>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer">
                      <td className="p-4 text-sm text-white font-medium">{lead.name}</td>
                      <td className="p-4 text-sm text-slate-300">{lead.email}</td>
                      <td className="p-4">
                        <Badge className={`capitalize ${statusColors[lead.status] || "bg-slate-500/20 text-slate-400"}`}>
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right text-sm text-white font-medium">{lead.score}</td>
                      <td className="p-4 text-sm text-slate-400">{lead.source}</td>
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 20)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
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
