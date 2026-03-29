"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DetailDrawer, DrawerTabs } from "@/components/ui/detail-drawer";
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Cpu,
  HardDrive,
  Users,
  Crown,
  Calendar,
  Mail,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

/* ---------- types ---------- */

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  deviceLimit: number;
  storageLimit: number;
  createdAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
  deviceCount: number;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

interface ApiResponse {
  data: Organization[];
  pagination: Pagination;
}

/* ---------- helpers ---------- */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ---------- component ---------- */

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0 });
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // drawer state
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [drawerTab, setDrawerTab] = useState("overview");

  /* ---- fetch ---- */

  const fetchOrgs = useCallback(async (page: number, searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/admin/organizations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setOrgs(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch organizations");
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrgs(1, search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchOrgs]);

  /* ---- derived data ---- */

  const filteredOrgs = useMemo(() => {
    if (planFilter === "all") return orgs;
    return orgs.filter((o) => o.plan === planFilter);
  }, [orgs, planFilter]);

  const planCounts = useMemo(() => {
    const counts: Record<string, number> = { free: 0, pro: 0, team: 0, enterprise: 0 };
    orgs.forEach((o) => {
      if (counts[o.plan] !== undefined) counts[o.plan]++;
    });
    return counts;
  }, [orgs]);

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const filterOptions = [
    { value: "all", label: "All", count: orgs.length },
    { value: "free", label: "Free", count: planCounts.free },
    { value: "pro", label: "Pro", count: planCounts.pro },
    { value: "team", label: "Team", count: planCounts.team },
    { value: "enterprise", label: "Enterprise", count: planCounts.enterprise },
  ];

  /* ---- stat cards ---- */

  const statCards = [
    { label: "Total Orgs", value: pagination.total, icon: Building2, color: "text-red-400" },
    { label: "Free", value: planCounts.free, icon: Users, color: "text-slate-400" },
    { label: "Pro", value: planCounts.pro, icon: Crown, color: "text-blue-400" },
    { label: "Team", value: planCounts.team, icon: Users, color: "text-purple-400" },
    { label: "Enterprise", value: planCounts.enterprise, icon: Crown, color: "text-amber-400" },
  ];

  /* ---- render ---- */

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-red-400" />
            Organizations
          </h1>
          <p className="text-slate-400 mt-1">
            Manage all registered organizations across the platform
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchOrgs(pagination.page, search)}
          className="border-slate-700 text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold text-white">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-red-500/50"
          />
        </div>
        <FilterTabs options={filterOptions} value={planFilter} onChange={setPlanFilter} />
      </div>

      {/* Error state */}
      {error && (
        <Card className="bg-red-950/30 border-red-900/50 mb-6">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOrgs(pagination.page, search)}
              className="ml-auto border-red-800 text-red-400 hover:text-white"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Slug</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Plan</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Devices</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Owner</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-800 rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <Building2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No organizations found</p>
                      {search && (
                        <p className="text-slate-600 text-xs mt-1">
                          Try adjusting your search term
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr
                      key={org.id}
                      onClick={() => {
                        setSelectedOrg(org);
                        setDrawerTab("overview");
                      }}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="text-sm font-medium text-white">{org.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 font-mono">{org.slug}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={org.plan} />
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        <span className={org.deviceCount >= org.deviceLimit ? "text-red-400" : ""}>
                          {org.deviceCount}
                        </span>
                        <span className="text-slate-600"> / {org.deviceLimit}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {org.ownerEmail || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(org.createdAt)}
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
                Page {pagination.page} of {totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchOrgs(pagination.page - 1, search)}
                  disabled={pagination.page <= 1}
                  className="h-8 w-8 border-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchOrgs(pagination.page + 1, search)}
                  disabled={pagination.page >= totalPages}
                  className="h-8 w-8 border-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedOrg}
        onClose={() => setSelectedOrg(null)}
        title={selectedOrg?.name || ""}
        subtitle={selectedOrg?.slug}
      >
        {selectedOrg && (
          <>
            <DrawerTabs
              tabs={[
                { id: "overview", label: "Overview", icon: <Building2 className="w-4 h-4" /> },
                { id: "plan", label: "Plan Details", icon: <Crown className="w-4 h-4" /> },
              ]}
              active={drawerTab}
              onChange={setDrawerTab}
            />

            {drawerTab === "overview" && (
              <div className="p-6 space-y-6">
                {/* Org info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Organization Info
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem icon={Building2} label="Name" value={selectedOrg.name} />
                    <InfoItem icon={Mail} label="Slug" value={selectedOrg.slug} mono />
                    <InfoItem
                      icon={Mail}
                      label="Owner"
                      value={selectedOrg.ownerName || selectedOrg.ownerEmail || "N/A"}
                    />
                    <InfoItem
                      icon={Calendar}
                      label="Created"
                      value={formatDate(selectedOrg.createdAt)}
                    />
                  </div>
                </div>

                {/* Devices */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Device Usage
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-slate-500" />
                        Devices
                      </span>
                      <span className="text-sm font-medium text-white">
                        {selectedOrg.deviceCount} / {selectedOrg.deviceLimit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          selectedOrg.deviceCount >= selectedOrg.deviceLimit
                            ? "bg-red-500"
                            : selectedOrg.deviceCount >= selectedOrg.deviceLimit * 0.8
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(100, (selectedOrg.deviceCount / selectedOrg.deviceLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Storage */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Storage
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4 flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-300">Storage Limit</p>
                      <p className="text-lg font-semibold text-white">
                        {formatBytes(selectedOrg.storageLimit)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {drawerTab === "plan" && (
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Current Plan
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown className="w-5 h-5 text-amber-400" />
                      <span className="text-white font-medium capitalize">{selectedOrg.plan}</span>
                    </div>
                    <StatusBadge status={selectedOrg.plan} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Plan Limits
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Cpu className="w-4 h-4" /> Max Devices
                      </span>
                      <span className="text-white font-medium">{selectedOrg.deviceLimit}</span>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <HardDrive className="w-4 h-4" /> Max Storage
                      </span>
                      <span className="text-white font-medium">
                        {formatBytes(selectedOrg.storageLimit)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedOrg.subscriptionStatus && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                      Subscription
                    </h3>
                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Status</span>
                        <StatusBadge status={selectedOrg.subscriptionStatus} />
                      </div>
                      {selectedOrg.stripeCustomerId && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Stripe ID</span>
                          <span className="text-xs text-slate-500 font-mono">
                            {selectedOrg.stripeCustomerId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}

/* ---------- sub-components ---------- */

function InfoItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </p>
      <p className={`text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
