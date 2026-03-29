"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Flag,
  Plus,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Gauge,
} from "lucide-react";

/* ---------- Types ---------- */

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  createdAt: string;
  updatedAt?: string;
}

/* ---------- Page ---------- */

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchFlags = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (search) params.set("search", search);

    fetch(`/api/operations/feature-flags?${params}`)
      .then((r) => r.json())
      .then((res) => setFlags(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  /* Summary stats */
  const summary = useMemo(() => {
    const enabled = flags.filter((f) => f.enabled).length;
    const disabled = flags.filter((f) => !f.enabled).length;
    const partial = flags.filter(
      (f) => f.enabled && f.rolloutPercentage < 100
    ).length;
    return { enabled, disabled, partial };
  }, [flags]);

  /* Toggle */
  const handleToggle = async (flag: FeatureFlag) => {
    try {
      const res = await fetch("/api/operations/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flag.id, enabled: !flag.enabled }),
      });
      if (res.ok) {
        setFlags((prev) =>
          prev.map((f) =>
            f.id === flag.id ? { ...f, enabled: !f.enabled } : f
          )
        );
      }
    } catch {
      // silent
    }
  };

  /* Rollout change */
  const handleRolloutChange = async (flag: FeatureFlag, pct: number) => {
    try {
      const res = await fetch("/api/operations/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flag.id, rolloutPercentage: pct }),
      });
      if (res.ok) {
        setFlags((prev) =>
          prev.map((f) =>
            f.id === flag.id ? { ...f, rolloutPercentage: pct } : f
          )
        );
      }
    } catch {
      // silent
    }
  };

  /* Delete */
  const handleDelete = async (flag: FeatureFlag) => {
    if (!confirm(`Delete feature flag "${flag.key || flag.name}"?`)) return;
    try {
      const res = await fetch(`/api/operations/feature-flags/${flag.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFlags((prev) => prev.filter((f) => f.id !== flag.id));
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag className="w-6 h-6 text-primary" /> Feature Flags
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Toggle features, manage rollouts, and configure flags
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create Flag
        </Button>
      </div>

      {/* Summary */}
      {flags.length > 0 && (
        <div className="flex gap-6 text-sm">
          <div className="text-slate-400">
            <span className="font-bold text-green-400">
              {summary.enabled}
            </span>{" "}
            enabled
          </div>
          <div className="text-slate-400">
            <span className="font-bold text-slate-300">
              {summary.disabled}
            </span>{" "}
            disabled
          </div>
          <div className="text-slate-400">
            <span className="font-bold text-amber-400">
              {summary.partial}
            </span>{" "}
            partial rollout
          </div>
        </div>
      )}

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search flags by name, key, or description..."
        className="max-w-md"
      />

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 mx-auto animate-spin" />
          <p className="mt-2 text-sm">Loading feature flags...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-red-500/30">
          <CardContent className="p-4 text-red-400 text-sm">
            Failed to load feature flags.
          </CardContent>
        </Card>
      )}

      {/* Flag Cards */}
      {!loading && !error && (
        <div className="space-y-3">
          {flags.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Flag className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400">No feature flags found.</p>
                <p className="text-slate-500 text-sm mt-1">
                  Create one to start managing feature rollouts.
                </p>
              </CardContent>
            </Card>
          ) : (
            flags.map((flag) => (
              <Card
                key={flag.id}
                className={`transition-all ${
                  flag.enabled
                    ? "border-green-500/30"
                    : "border-slate-800"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: toggle + info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Toggle switch */}
                      <button
                        onClick={() => handleToggle(flag)}
                        className="mt-0.5 flex-shrink-0"
                        title={flag.enabled ? "Disable" : "Enable"}
                      >
                        {flag.enabled ? (
                          <ToggleRight className="w-8 h-8 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-600" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-white">
                            {flag.key || flag.name}
                          </span>
                          {flag.key && flag.name !== flag.key && (
                            <span className="text-sm text-slate-400 truncate">
                              {flag.name}
                            </span>
                          )}
                          <Badge
                            variant={flag.enabled ? "success" : "secondary"}
                          >
                            {flag.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>

                        {flag.description && (
                          <p className="text-xs text-slate-500 mt-1 truncate">
                            {flag.description}
                          </p>
                        )}

                        {/* Rollout slider */}
                        <div className="mt-3 flex items-center gap-3">
                          <Gauge className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <div className="flex-1 max-w-xs">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={flag.rolloutPercentage}
                                onChange={(e) =>
                                  setFlags((prev) =>
                                    prev.map((f) =>
                                      f.id === flag.id
                                        ? {
                                            ...f,
                                            rolloutPercentage: parseInt(
                                              e.target.value
                                            ),
                                          }
                                        : f
                                    )
                                  )
                                }
                                onMouseUp={(e) =>
                                  handleRolloutChange(
                                    flag,
                                    parseInt(
                                      (e.target as HTMLInputElement).value
                                    )
                                  )
                                }
                                onTouchEnd={(e) =>
                                  handleRolloutChange(
                                    flag,
                                    parseInt(
                                      (e.target as HTMLInputElement).value
                                    )
                                  )
                                }
                                className="flex-1 accent-primary h-1.5 cursor-pointer"
                              />
                              <span className="text-xs font-mono text-slate-300 w-10 text-right">
                                {flag.rolloutPercentage}%
                              </span>
                            </div>
                            {/* Visual bar */}
                            <div className="mt-1 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  flag.rolloutPercentage === 100
                                    ? "bg-green-500"
                                    : flag.rolloutPercentage > 0
                                    ? "bg-amber-500"
                                    : "bg-slate-700"
                                }`}
                                style={{
                                  width: `${flag.rolloutPercentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          {flag.rolloutPercentage < 100 && flag.enabled && (
                            <span className="text-amber-400">
                              Partial rollout
                            </span>
                          )}
                          {flag.updatedAt && (
                            <span>
                              Updated{" "}
                              {new Date(flag.updatedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(flag)}
                      className="text-slate-500 hover:text-red-400 flex-shrink-0"
                      title="Delete flag"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <CreateFlagDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchFlags();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Create Flag Dialog ---------- */

function CreateFlagDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [rollout, setRollout] = useState(100);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);

  const autoKey = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleNameChange = (v: string) => {
    setName(v);
    if (!keyTouched) {
      setKey(autoKey(v));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !key) return;
    setSaving(true);
    try {
      const res = await fetch("/api/operations/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          key,
          description,
          rolloutPercentage: rollout,
          enabled,
        }),
      });
      if (res.ok) {
        onCreated();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Feature Flag</DialogTitle>
          <DialogDescription>
            Define a new feature flag for rollout control.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Name *
            </label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Dark Mode Beta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Key *
            </label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setKeyTouched(true);
              }}
              placeholder="e.g. dark-mode-beta"
              className="font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Lowercase alphanumeric with hyphens. Used in code.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Rollout %
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={rollout}
                onChange={(e) =>
                  setRollout(parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <label className="text-sm font-medium text-slate-300">
                Enabled
              </label>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                title={enabled ? "Disable" : "Enable"}
              >
                {enabled ? (
                  <ToggleRight className="w-8 h-8 text-green-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name || !key || saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Flag"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
