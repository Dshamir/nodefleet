"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailDrawer, DrawerTabs } from "@/components/ui/detail-drawer";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Shield,
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

/* ---------- types ---------- */

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

interface ApiResponse {
  data: UserRecord[];
  pagination: Pagination;
}

/* ---------- helpers ---------- */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

/* ---------- component ---------- */

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // drawer state
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState("overview");

  /* ---- fetch ---- */

  const fetchUsers = useCallback(async (page: number, searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setUsers(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(1, search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  /* ---- render ---- */

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-red-400" />
            Users
          </h1>
          <p className="text-slate-400 mt-1">
            All registered users across the platform ({pagination.total} total)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchUsers(pagination.page, search)}
          className="border-slate-700 text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-red-500/50"
          />
        </div>
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
              onClick={() => fetchUsers(pagination.page, search)}
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
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
                    Email
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
                    Role
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-6 py-3">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-800 rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No users found</p>
                      {search && (
                        <p className="text-slate-600 text-xs mt-1">
                          Try adjusting your search term
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setDrawerTab("overview");
                      }}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-xs font-medium text-slate-400">
                            {getInitials(user.name, user.email)}
                          </div>
                          <span className="text-sm font-medium text-white">
                            {user.name || "Unnamed"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{user.email}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={user.role} />
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(user.createdAt)}
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
                  onClick={() => fetchUsers(pagination.page - 1, search)}
                  disabled={pagination.page <= 1}
                  className="h-8 w-8 border-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchUsers(pagination.page + 1, search)}
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
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || selectedUser?.email || ""}
        subtitle={selectedUser?.email}
      >
        {selectedUser && (
          <>
            <DrawerTabs
              tabs={[
                { id: "overview", label: "Overview", icon: <User className="w-4 h-4" /> },
              ]}
              active={drawerTab}
              onChange={setDrawerTab}
            />

            {drawerTab === "overview" && (
              <div className="p-6 space-y-6">
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-xl font-semibold text-slate-400">
                    {getInitials(selectedUser.name, selectedUser.email)}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {selectedUser.name || "Unnamed User"}
                    </p>
                    <p className="text-sm text-slate-400">{selectedUser.email}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Account Details
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Email
                      </span>
                      <span className="text-sm text-white">{selectedUser.email}</span>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Role
                      </span>
                      <StatusBadge status={selectedUser.role} />
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Joined
                      </span>
                      <span className="text-sm text-white">
                        {formatDateFull(selectedUser.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User ID */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    System
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">User ID</p>
                    <p className="text-xs text-slate-400 font-mono break-all">{selectedUser.id}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
