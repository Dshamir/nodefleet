"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Flag, Loader2 } from "lucide-react";

interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  targetOrgs: unknown;
  createdAt: string;
  updatedAt: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/feature-flags")
      .then((res) => res.json())
      .then((json) => setFlags(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleFlag = async (flag: FeatureFlag) => {
    setUpdating(flag.id);
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flag.id, enabled: !flag.enabled }),
      });
      if (res.ok) {
        const json = await res.json();
        setFlags((prev) =>
          prev.map((f) => (f.id === flag.id ? json.data : f))
        );
      }
    } catch {
      // ignore
    } finally {
      setUpdating(null);
    }
  };

  const updateRollout = async (flag: FeatureFlag, percentage: number) => {
    setUpdating(flag.id);
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flag.id, rolloutPercentage: percentage }),
      });
      if (res.ok) {
        const json = await res.json();
        setFlags((prev) =>
          prev.map((f) => (f.id === flag.id ? json.data : f))
        );
      }
    } catch {
      // ignore
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag className="w-6 h-6 text-red-400" />
            Feature Flags
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-800 rounded w-32 mb-3" />
                <div className="h-3 bg-slate-800 rounded w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Flag className="w-6 h-6 text-red-400" />
          Feature Flags
        </h1>
        <p className="text-slate-400 mt-1">
          Global feature toggles and rollout controls ({flags.length} flags)
        </p>
      </div>

      {flags.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-12 text-center">
            <Flag className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500">No feature flags configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flags.map((flag) => (
            <Card
              key={flag.id}
              className={`border transition-colors ${
                flag.enabled
                  ? "bg-green-500/5 border-green-500/30"
                  : "bg-slate-900/50 border-slate-800"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 mr-4">
                    <h3 className="text-sm font-semibold text-white font-mono">
                      {flag.name}
                    </h3>
                    {flag.description && (
                      <p className="text-xs text-slate-400 mt-1">{flag.description}</p>
                    )}
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleFlag(flag)}
                    disabled={updating === flag.id}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50"
                    style={{
                      backgroundColor: flag.enabled ? "rgb(34 197 94)" : "rgb(51 65 85)",
                    }}
                  >
                    {updating === flag.id ? (
                      <Loader2 className="w-3 h-3 text-white animate-spin absolute left-1/2 -translate-x-1/2" />
                    ) : (
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          flag.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    )}
                  </button>
                </div>

                {/* Rollout percentage */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">Rollout</span>
                    <span className="text-xs font-mono text-slate-400">
                      {flag.rolloutPercentage}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={flag.rolloutPercentage}
                    onChange={(e) => updateRollout(flag, parseInt(e.target.value))}
                    disabled={updating === flag.id}
                    className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-red-500 disabled:opacity-50"
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      flag.enabled
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                    }`}
                  >
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span className="text-xs text-slate-600">
                    Updated {new Date(flag.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
