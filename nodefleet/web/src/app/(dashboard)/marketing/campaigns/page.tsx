"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Pause,
  CheckCircle,
  BarChart3,
  Send,
  Eye,
  Calendar,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  subject?: string;
  sentCount: number;
  openCount?: number;
  openRate: number;
  scheduledAt?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const TYPE_OPTIONS = ["email", "sms", "push", "drip"];

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-400">{title}</span>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-800/80">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        <div className="text-2xl font-bold text-white">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Campaign Dialog                                             */
/* ------------------------------------------------------------------ */

function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("email");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          subject: subject.trim() || undefined,
          status: "draft",
        }),
      });
      onCreated();
      onOpenChange(false);
      setName("");
      setType("email");
      setSubject("");
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription>
            Set up a new marketing campaign. You can configure steps after creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Product Launch"
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t} className="bg-slate-900">
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Subject Line <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Don't miss our spring deals!"
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Campaigns Page                                                     */
/* ------------------------------------------------------------------ */

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/marketing/campaigns?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, refreshKey]);

  const totalPages = Math.ceil(total / limit);

  /* Computed stats */
  const totalCount = total;
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const pausedCount = campaigns.filter((c) => c.status === "paused").length;
  const completedCount = campaigns.filter((c) => c.status === "completed").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> Campaigns
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create and manage marketing campaigns.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Create Campaign
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-24" />
                  <div className="h-8 bg-slate-800 rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard title="Total" value={totalCount} icon={BarChart3} color="text-blue-400" />
            <StatCard title="Active" value={activeCount} icon={Play} color="text-green-400" />
            <StatCard title="Paused" value={pausedCount} icon={Pause} color="text-orange-400" />
            <StatCard
              title="Completed"
              value={completedCount}
              icon={CheckCircle}
              color="text-purple-400"
            />
          </>
        )}
      </div>

      {/* Filter Tabs */}
      <FilterTabs
        options={FILTER_OPTIONS}
        value={statusFilter}
        onChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
      />

      {/* Data Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Name</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Type</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Status</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Subject</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Scheduled</th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4">
                    <div className="flex items-center justify-end gap-1">
                      <Send className="w-3 h-3" /> Sent
                    </div>
                  </th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4">
                    <div className="flex items-center justify-end gap-1">
                      <Eye className="w-3 h-3" /> Opened
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="p-4">
                          <div className="h-4 bg-slate-800 rounded w-20 animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No campaigns yet</p>
                      <p className="text-slate-500 text-sm mt-1">
                        Create a campaign to start reaching your audience.
                      </p>
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                      onClick={() =>
                        (window.location.href = `/marketing/campaigns/${campaign.id}`)
                      }
                    >
                      <td className="p-4 text-sm text-white font-medium">{campaign.name}</td>
                      <td className="p-4">
                        <StatusBadge status={campaign.type} />
                      </td>
                      <td className="p-4">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="p-4 text-sm text-slate-400 max-w-[200px] truncate">
                        {campaign.subject || "--"}
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {campaign.scheduledAt ? (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(campaign.scheduledAt).toLocaleDateString()}
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td className="p-4 text-right text-sm text-white">
                        {campaign.sentCount?.toLocaleString() || "0"}
                      </td>
                      <td className="p-4 text-right text-sm">
                        {campaign.openRate != null ? (
                          <span className="text-green-400">
                            {(campaign.openRate * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * limit + 1}--{Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-400 flex items-center px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
