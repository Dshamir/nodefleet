"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  Target,
  TrendingUp,
  DollarSign,
  ClipboardList,
  BarChart3,
  Megaphone,
  ArrowUpRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CrmStats {
  totalContacts: number;
  totalLeads: number;
  conversionRate: number;
  pipelineValue: number;
}

interface SegmentEntry {
  label: string;
  count: number;
  color: string;
  barColor: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data helpers (replace with API calls when backend is ready)   */
/* ------------------------------------------------------------------ */

function fetchCrmStats(): Promise<CrmStats> {
  return Promise.all([
    fetch("/api/crm/contacts").then((r) => r.json()).catch(() => ({ data: [], pagination: {} })),
    fetch("/api/crm/leads").then((r) => r.json()).catch(() => ({ data: [], pagination: {} })),
  ]).then(([contactsRes, leadsRes]) => {
    const totalContacts = contactsRes.pagination?.total || contactsRes.data?.length || 0;
    const totalLeads = leadsRes.pagination?.total || leadsRes.data?.length || 0;
    const leads = leadsRes.data || [];
    const wonLeads = leads.filter((l: { status: string }) => l.status === "won").length;
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const pipelineValue = leads.reduce((sum: number, l: { value?: number }) => sum + (l.value || 0), 0);
    return { totalContacts, totalLeads, conversionRate, pipelineValue };
  });
}

function buildSegments(leads: Array<{ status: string }>): SegmentEntry[] {
  const STAGES: Record<string, { color: string; barColor: string }> = {
    new: { color: "text-yellow-400", barColor: "bg-yellow-500" },
    contacted: { color: "text-blue-400", barColor: "bg-blue-500" },
    qualified: { color: "text-cyan-400", barColor: "bg-cyan-500" },
    proposal: { color: "text-purple-400", barColor: "bg-purple-500" },
    negotiation: { color: "text-indigo-400", barColor: "bg-indigo-500" },
    won: { color: "text-green-400", barColor: "bg-green-500" },
    lost: { color: "text-red-400", barColor: "bg-red-500" },
  };

  const counts: Record<string, number> = {};
  for (const l of leads) {
    counts[l.status] = (counts[l.status] || 0) + 1;
  }

  return Object.entries(STAGES).map(([key, colors]) => ({
    label: key,
    count: counts[key] || 0,
    ...colors,
  }));
}

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
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-400">{title}</span>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-slate-800/80`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick Link Card                                                    */
/* ------------------------------------------------------------------ */

function QuickLinkCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}) {
  return (
    <Link href={href}>
      <Card className="bg-slate-900/50 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700 cursor-pointer transition-all group">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{title}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  CRM Dashboard Page                                                 */
/* ------------------------------------------------------------------ */

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [segments, setSegments] = useState<SegmentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [crmStats, leadsRes] = await Promise.all([
          fetchCrmStats(),
          fetch("/api/crm/leads?limit=500").then((r) => r.json()).catch(() => ({ data: [] })),
        ]);
        setStats(crmStats);
        setSegments(buildSegments(leadsRes.data || []));
      } catch {
        /* API may not be live yet */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const maxCount = Math.max(1, ...segments.map((s) => s.count));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> CRM Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Customer relationship management overview and pipeline analytics.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <StatCard
              title="Total Contacts"
              value={stats?.totalContacts?.toLocaleString() || "0"}
              icon={Users}
              color="text-blue-400"
            />
            <StatCard
              title="Total Leads"
              value={stats?.totalLeads?.toLocaleString() || "0"}
              icon={Target}
              color="text-green-400"
            />
            <StatCard
              title="Conversion Rate"
              value={`${stats?.conversionRate || 0}%`}
              icon={TrendingUp}
              color="text-purple-400"
            />
            <StatCard
              title="Pipeline Value"
              value={`$${(stats?.pipelineValue || 0).toLocaleString()}`}
              icon={DollarSign}
              color="text-amber-400"
            />
          </>
        )}
      </div>

      {/* Segment Breakdown */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Pipeline Breakdown</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-800/50 rounded animate-pulse" />
              ))}
            </div>
          ) : segments.length === 0 || segments.every((s) => s.count === 0) ? (
            <p className="text-sm text-slate-500">No lead data available yet.</p>
          ) : (
            <div className="space-y-3">
              {segments.map((seg) => {
                const widthPercent = (seg.count / maxCount) * 100;
                return (
                  <div key={seg.label} className="flex items-center gap-4">
                    <div className="w-24 flex-shrink-0">
                      <span className={`text-sm font-medium capitalize ${seg.color}`}>
                        {seg.label}
                      </span>
                    </div>
                    <div className="flex-1 h-8 rounded-lg bg-slate-800/50 overflow-hidden">
                      <div
                        className={`h-full rounded-lg ${seg.barColor} flex items-center justify-end pr-2 transition-all duration-500`}
                        style={{ width: `${Math.max(widthPercent, 3)}%` }}
                      >
                        {seg.count > 0 && (
                          <span className="text-xs font-semibold text-white drop-shadow-sm">
                            {seg.count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickLinkCard
            title="Leads"
            description="View and manage sales leads pipeline"
            href="/crm/leads"
            icon={Target}
          />
          <QuickLinkCard
            title="Contacts"
            description="Browse customer contact records"
            href="/crm/contacts"
            icon={Users}
          />
          <QuickLinkCard
            title="Lead Forms"
            description="Configure lead capture forms"
            href="/crm/lead-forms"
            icon={ClipboardList}
          />
          <QuickLinkCard
            title="Campaigns"
            description="Email and marketing campaigns"
            href="/marketing/campaigns"
            icon={Megaphone}
          />
        </div>
      </div>
    </div>
  );
}
