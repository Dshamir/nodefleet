"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  sentCount: number;
  openRate: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400",
  scheduled: "bg-blue-500/20 text-blue-400",
  active: "bg-green-500/20 text-green-400",
  paused: "bg-amber-500/20 text-amber-400",
  completed: "bg-purple-500/20 text-purple-400",
  cancelled: "bg-red-500/20 text-red-400",
};

const typeColors: Record<string, string> = {
  email: "bg-cyan-500/20 text-cyan-400",
  sms: "bg-indigo-500/20 text-indigo-400",
  push: "bg-pink-500/20 text-pink-400",
  drip: "bg-teal-500/20 text-teal-400",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/marketing/campaigns?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" /> Campaigns
        </h1>
        <p className="text-slate-400 text-sm mt-1">{total} total campaigns</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "draft", "scheduled", "active", "paused", "completed", "cancelled"].map((s) => (
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
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Campaign</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Type</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Status</th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4">Sent</th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4">Open Rate</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-32 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No campaigns yet</p>
                      <p className="text-slate-500 text-sm mt-1">Create a campaign to start reaching your audience.</p>
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                      onClick={() => (window.location.href = `/marketing/campaigns/${campaign.id}`)}
                    >
                      <td className="p-4 text-sm text-white font-medium">{campaign.name}</td>
                      <td className="p-4">
                        <Badge className={`capitalize ${typeColors[campaign.type] || "bg-slate-500/20 text-slate-400"}`}>
                          {campaign.type}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={`capitalize ${statusColors[campaign.status] || "bg-slate-500/20 text-slate-400"}`}>
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right text-sm text-white">{campaign.sentCount?.toLocaleString()}</td>
                      <td className="p-4 text-right text-sm text-white">
                        {campaign.openRate != null ? `${(campaign.openRate * 100).toFixed(1)}%` : "--"}
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(campaign.createdAt).toLocaleDateString()}
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
