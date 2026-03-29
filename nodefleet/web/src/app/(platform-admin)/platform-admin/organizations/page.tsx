"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Search, ChevronLeft, ChevronRight } from "lucide-react";

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
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

const planColors: Record<string, string> = {
  free: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  pro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  team: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  enterprise: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async (page: number, searchTerm: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/admin/organizations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setOrgs(json.data);
      setPagination(json.pagination);
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrgs(1, search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchOrgs]);

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-red-400" />
            Organizations
          </h1>
          <p className="text-slate-400 mt-1">
            All registered organizations across the platform ({pagination.total} total)
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
          />
        </div>
      </div>

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
                ) : orgs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => (
                    <tr key={org.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{org.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-400 font-mono">{org.slug}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${planColors[org.plan] || planColors.free}`}>
                          {org.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {org.deviceCount} / {org.deviceLimit}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {org.ownerEmail || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(org.createdAt).toLocaleDateString()}
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
                  onClick={() => fetchOrgs(pagination.page - 1, search)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fetchOrgs(pagination.page + 1, search)}
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
