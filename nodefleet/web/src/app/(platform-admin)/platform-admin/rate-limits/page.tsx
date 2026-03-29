"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Gauge,
  Plus,
  Zap,
} from "lucide-react";

interface RateLimitRule {
  id: string;
  name: string;
  scope: string;
  endpoint: string | null;
  maxRequests: number;
  windowSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const SCOPES = ["global", "per-tenant", "per-user", "per-endpoint"];

const SCOPE_COLORS: Record<string, string> = {
  global: "bg-red-500/20 text-red-400 border-red-500/30",
  "per-tenant": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "per-user": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "per-endpoint": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-green-500" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function RateLimitsPage() {
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState("global");
  const [newEndpoint, setNewEndpoint] = useState("");
  const [newMaxRequests, setNewMaxRequests] = useState(100);
  const [newWindow, setNewWindow] = useState(60);
  const [creating, setCreating] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/security/rate-limits");
      if (!res.ok) return;
      const data = await res.json();
      setRules(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await fetch("/api/security/rate-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled } : r))
      );
    } catch {
      /* ignore */
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/security/rate-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          scope: newScope,
          endpoint: newEndpoint || undefined,
          maxRequests: newMaxRequests,
          windowSeconds: newWindow,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setNewName("");
        setNewScope("global");
        setNewEndpoint("");
        setNewMaxRequests(100);
        setNewWindow(60);
        fetchRules();
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  function formatWindow(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Rate Limits</h1>
          <p className="text-slate-400">
            Configure API rate limiting rules to prevent abuse
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-4 h-4" /> Create Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-16 text-center">
            <Gauge className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500">No rate limit rules configured</p>
            <p className="text-xs text-slate-600 mt-1">
              Create rules to throttle API requests
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400 font-normal">
                  Rule
                </th>
                <th className="text-left py-3 px-4 text-slate-400 font-normal">
                  Scope
                </th>
                <th className="text-left py-3 px-4 text-slate-400 font-normal">
                  Endpoint
                </th>
                <th className="text-center py-3 px-4 text-slate-400 font-normal">
                  Limit
                </th>
                <th className="text-center py-3 px-4 text-slate-400 font-normal">
                  Window
                </th>
                <th className="text-center py-3 px-4 text-slate-400 font-normal">
                  Status
                </th>
                <th className="text-center py-3 px-4 text-slate-400 font-normal">
                  Enabled
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`border-b border-slate-800/50 ${
                    !rule.enabled ? "opacity-50" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-white font-medium">
                        {rule.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${
                        SCOPE_COLORS[rule.scope] ||
                        "bg-slate-500/20 text-slate-400 border-slate-500/30"
                      }`}
                    >
                      {rule.scope}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {rule.endpoint ? (
                      <code className="text-xs text-cyan-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
                        {rule.endpoint}
                      </code>
                    ) : (
                      <span className="text-xs text-slate-500">All</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-white font-mono">
                      {rule.maxRequests}
                    </span>
                    <span className="text-slate-500 text-xs"> req</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-slate-300 font-mono">
                      {formatWindow(rule.windowSeconds)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge
                      status={rule.enabled ? "active" : "disabled"}
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Toggle
                      checked={rule.enabled}
                      onChange={(v) => handleToggle(rule.id, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle>Create Rate Limit Rule</DialogTitle>
            <DialogDescription>
              Define a new rate limiting rule for your API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rule Name
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. API Global Limit"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Scope
              </label>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewScope(s)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${
                      newScope === s
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {newScope === "per-endpoint" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Endpoint Pattern
                </label>
                <Input
                  value={newEndpoint}
                  onChange={(e) => setNewEndpoint(e.target.value)}
                  placeholder="/api/devices/*"
                  className="bg-slate-800 border-slate-700 font-mono text-sm"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Max Requests
                </label>
                <Input
                  type="number"
                  value={newMaxRequests}
                  onChange={(e) =>
                    setNewMaxRequests(parseInt(e.target.value) || 100)
                  }
                  min={1}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Window (seconds)
                </label>
                <Input
                  type="number"
                  value={newWindow}
                  onChange={(e) =>
                    setNewWindow(parseInt(e.target.value) || 60)
                  }
                  min={1}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {newMaxRequests} requests per {formatWindow(newWindow)}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 gap-2"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
