"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Building2,
  Users,
  Cpu,
  Activity,
  DollarSign,
  Shield,
  RefreshCw,
  Clock,
  Flag,
  CreditCard,
  FileText,
  ChevronRight,
  Wifi,
  WifiOff,
  Database,
  Server,
  HardDrive,
  Radio,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalOrgs: number;
  totalUsers: number;
  totalDevices: number;
  onlineDevices: number;
  mrr: string;
  systemHealth: string;
}

interface ComponentHealth {
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
  components: Record<string, ComponentHealth>;
}

interface AuditEntry {
  id: string;
  orgId: string | null;
  userId: string | null;
  deviceId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditResponse {
  data: AuditEntry[];
  pagination: { page: number; limit: number; total: number };
}

// ── Service config for the health table ────────────────────────────────────

const SERVICE_META: Record<string, { label: string; icon: typeof Database }> = {
  postgres: { label: "PostgreSQL", icon: Database },
  redis: { label: "Redis", icon: Server },
  s3: { label: "MinIO / S3", icon: HardDrive },
  mqtt: { label: "MQTT Broker", icon: Radio },
};

// ── Quick action definitions ───────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Organizations", href: "/platform-admin/organizations", icon: Building2, description: "Manage tenants" },
  { label: "Users", href: "/platform-admin/users", icon: Users, description: "User accounts" },
  { label: "Feature Flags", href: "/platform-admin/feature-flags", icon: Flag, description: "Toggle features" },
  { label: "Subscriptions", href: "/platform-admin/subscriptions", icon: CreditCard, description: "Plans & billing" },
  { label: "Audit Log", href: "/platform-admin/audit", icon: FileText, description: "Activity history" },
  { label: "System Health", href: "/platform-admin/health", icon: Activity, description: "Service status" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusToLabel(status: string): string {
  if (status === "ok") return "healthy";
  return status;
}

function latencyColor(ms: number | undefined): string {
  if (ms === undefined) return "text-slate-500";
  if (ms > 200) return "text-red-400";
  if (ms > 50) return "text-amber-400";
  return "text-green-400";
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setStatsError(null);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setHealthError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Failed to load health");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit?limit=10&page=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuditResponse = await res.json();
      setAudit(data.data);
    } catch {
      // Silently degrade — audit is non-critical
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // ── Auto-refresh intervals ────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
    fetchHealth();
    fetchAudit();

    statsTimerRef.current = setInterval(fetchStats, 30_000);
    healthTimerRef.current = setInterval(fetchHealth, 10_000);

    return () => {
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    };
  }, [fetchStats, fetchHealth, fetchAudit]);

  // ── Manual refresh ────────────────────────────────────────────────────

  const handleRefresh = () => {
    setStatsLoading(true);
    setHealthLoading(true);
    fetchStats();
    fetchHealth();
    fetchAudit();
  };

  // ── Stat card definitions ─────────────────────────────────────────────

  const statCards = [
    {
      label: "Organizations",
      value: stats ? String(stats.totalOrgs) : "--",
      subtitle: "Active tenants",
      icon: Building2,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Total Users",
      value: stats ? String(stats.totalUsers) : "--",
      subtitle: "Across all orgs",
      icon: Users,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Total Devices",
      value: stats ? String(stats.totalDevices) : "--",
      subtitle: "Registered fleet",
      icon: Cpu,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
    },
    {
      label: "Online Devices",
      value: stats ? String(stats.onlineDevices) : "--",
      subtitle: stats
        ? `${stats.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0}% connected`
        : "Connectivity rate",
      icon: stats && stats.onlineDevices > 0 ? Wifi : WifiOff,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "MRR",
      value: stats?.mrr || "--",
      subtitle: "Monthly recurring revenue",
      icon: DollarSign,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
    },
    {
      label: "System Health",
      value: health
        ? health.status === "ok"
          ? "Healthy"
          : health.status === "degraded"
            ? "Degraded"
            : "Down"
        : "--",
      subtitle: health ? `Uptime: ${formatUptime(health.uptime)}` : "Checking...",
      icon: Shield,
      color: health?.status === "ok"
        ? "text-green-400"
        : health?.status === "degraded"
          ? "text-orange-400"
          : "text-red-400",
      bgColor: health?.status === "ok"
        ? "bg-green-500/10"
        : health?.status === "degraded"
          ? "bg-orange-500/10"
          : "bg-red-500/10",
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
          <p className="text-slate-400 mt-1">
            SaaS operator overview — all organizations and subscribers
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${statsLoading || healthLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {statsError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          Dashboard stats unavailable: {statsError}. Data will retry automatically.
        </div>
      )}

      {/* ── Stat Cards Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className={statsLoading && !stats ? "animate-pulse" : ""}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-400">{card.label}</span>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bgColor}`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{card.value}</div>
                <p className="text-xs text-slate-500 mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Middle Row: Service Health + Recent Activity ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Health Table (2/3 width) */}
        <Card className="lg:col-span-2">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Service Health</h2>
                {health && (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        health.status === "ok" ? "bg-green-400" : "bg-amber-400"
                      }`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        health.status === "ok" ? "bg-green-500" : "bg-amber-500"
                      }`} />
                    </span>
                    <span className="text-xs text-slate-500">Live</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {healthLoading && !health ? (
              <div className="p-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-slate-800/50 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ) : healthError ? (
              <div className="p-6 text-sm text-red-400">
                Unable to reach health endpoint: {healthError}
              </div>
            ) : health ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-right py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Latency
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(health.components).map(([key, comp]) => {
                      const meta = SERVICE_META[key] || { label: key, icon: Server };
                      const Icon = meta.icon;
                      return (
                        <tr
                          key={key}
                          className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4 text-slate-500" />
                              <span className="font-medium text-slate-200">{meta.label}</span>
                            </div>
                          </td>
                          <td className="py-3 px-6">
                            <StatusBadge status={statusToLabel(comp.status)} />
                          </td>
                          <td className="py-3 px-6 text-right">
                            {comp.status === "down" ? (
                              <span className="text-red-400 font-mono text-xs">--</span>
                            ) : (
                              <span className={`font-mono text-xs ${latencyColor(comp.latencyMs)}`}>
                                {comp.latencyMs !== undefined ? `${comp.latencyMs}ms` : "--"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-6">
                            {comp.error ? (
                              <span className="text-xs text-red-400 truncate max-w-[200px] inline-block">
                                {comp.error}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-600">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {health && (
              <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Version: {health.version}</span>
                <span>Uptime: {formatUptime(health.uptime)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity (1/3 width) */}
        <Card>
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              <Link
                href="/platform-admin/audit"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View all
              </Link>
            </div>
          </div>

          <CardContent className="p-0">
            {auditLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 bg-slate-800/50 rounded animate-pulse" />
                ))}
              </div>
            ) : audit.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">
                No recent activity recorded
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {audit.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-6 py-3 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-200 truncate">
                            {entry.action}
                          </span>
                          {entry.entityType && (
                            <StatusBadge status={entry.entityType} className="text-[10px]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          {entry.userId && (
                            <span className="truncate max-w-[120px]">{entry.userId.slice(0, 8)}...</span>
                          )}
                          <span>{formatRelativeTime(entry.createdAt)}</span>
                          {entry.ipAddress && (
                            <span className="text-slate-600">{entry.ipAddress}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions Grid ──────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="group cursor-pointer hover:border-slate-600 transition-all duration-200 hover:bg-slate-800/40">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                          <Icon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-200 group-hover:text-white transition-colors">
                            {action.label}
                          </div>
                          <div className="text-xs text-slate-500">{action.description}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
