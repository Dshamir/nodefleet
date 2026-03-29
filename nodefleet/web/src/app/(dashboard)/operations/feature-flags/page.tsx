"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, RefreshCw } from "lucide-react";

interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  createdAt: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = () => {
    setLoading(true);
    fetch("/api/operations/feature-flags")
      .then((r) => r.json())
      .then((res) => setFlags(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const toggleFlag = async (flag: FeatureFlag) => {
    try {
      const res = await fetch("/api/operations/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flag.id, enabled: !flag.enabled }),
      });
      if (res.ok) {
        setFlags((prev) =>
          prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f))
        );
      }
    } catch (err) {
      console.error("Failed to toggle flag:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag className="w-6 h-6 text-primary" /> Feature Flags
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Toggle features and manage rollout percentages.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchFlags} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-slate-800 rounded w-40" />
                  <div className="h-4 bg-slate-800 rounded w-64" />
                  <div className="h-8 bg-slate-800 rounded w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : flags.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-12 text-center">
            <Flag className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No feature flags configured yet.</p>
            <p className="text-slate-500 text-sm mt-1">
              Feature flags can be added via database seeds or the platform admin console.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flags.map((flag) => (
            <Card
              key={flag.id}
              className={`border transition-colors ${
                flag.enabled
                  ? "bg-slate-900/50 border-emerald-800/50"
                  : "bg-slate-900/50 border-slate-800"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{flag.name}</h3>
                    {flag.description && (
                      <p className="text-slate-400 text-sm mt-1">{flag.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          flag.enabled
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {flag.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Rollout: {flag.rolloutPercentage}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFlag(flag)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      flag.enabled ? "bg-emerald-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        flag.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
