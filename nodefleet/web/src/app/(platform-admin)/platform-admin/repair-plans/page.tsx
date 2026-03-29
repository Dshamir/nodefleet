"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface RepairPlan {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deviceId: string | null;
  steps: Array<{ order: number; title: string; description?: string; estimatedMinutes?: number }> | null;
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400",
  scheduled: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-cyan-500/20 text-cyan-400",
  completed: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function RepairPlansPage() {
  const [plans, setPlans] = useState<RepairPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/dev/repair-plans?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.data || []);
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
            <Wrench className="w-6 h-6 text-primary" /> Repair Plans
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} total repair plans</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "draft", "scheduled", "in_progress", "completed", "cancelled"].map((s) => (
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
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Steps</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Due Date</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-48 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-12 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : plans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500 py-12">
                      <Wrench className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                      <p>No repair plans found</p>
                      <p className="text-xs mt-1">Create a repair plan to track device maintenance.</p>
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4">
                        <p className="text-sm text-white font-medium">{plan.title}</p>
                        {plan.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{plan.description}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge className={`capitalize ${statusColors[plan.status] || "bg-slate-500/20 text-slate-400"}`}>
                          {plan.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {plan.steps ? `${plan.steps.length} steps` : "--"}
                      </td>
                      <td className="p-4">
                        {plan.dueDate ? (
                          <span className="text-sm text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(plan.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-600">--</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(plan.createdAt).toLocaleDateString()}
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
