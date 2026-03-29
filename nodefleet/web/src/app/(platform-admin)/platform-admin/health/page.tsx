"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Database, HardDrive, Radio, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface HealthStatus {
  status: string;
  timestamp?: string;
  services?: Record<string, { status: string; latency?: number; error?: string }>;
  [key: string]: unknown;
}

interface MetricsData {
  [key: string]: unknown;
}

interface ServiceCard {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "healthy" | "degraded" | "down" | "unknown";
  latency?: number;
  error?: string;
}

const statusConfig = {
  healthy: { color: "border-green-500/30 bg-green-500/5", badge: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2, iconColor: "text-green-400" },
  degraded: { color: "border-yellow-500/30 bg-yellow-500/5", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertCircle, iconColor: "text-yellow-400" },
  down: { color: "border-red-500/30 bg-red-500/5", badge: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, iconColor: "text-red-400" },
  unknown: { color: "border-slate-700 bg-slate-900/50", badge: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: AlertCircle, iconColor: "text-slate-400" },
};

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [healthRes, metricsRes] = await Promise.allSettled([
        fetch("/api/health").then((r) => r.json()),
        fetch("/api/metrics").then((r) => r.json()),
      ]);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value);
      if (metricsRes.status === "fulfilled") setMetrics(metricsRes.value);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const resolveStatus = (key: string): "healthy" | "degraded" | "down" | "unknown" => {
    if (!health?.services) return "unknown";
    const svc = health.services[key];
    if (!svc) return "unknown";
    if (svc.status === "ok" || svc.status === "healthy" || svc.status === "connected") return "healthy";
    if (svc.status === "degraded") return "degraded";
    if (svc.status === "error" || svc.status === "down" || svc.status === "disconnected") return "down";
    return "unknown";
  };

  const resolveLatency = (key: string): number | undefined => {
    if (!health?.services) return undefined;
    return health.services[key]?.latency;
  };

  const resolveError = (key: string): string | undefined => {
    if (!health?.services) return undefined;
    return health.services[key]?.error;
  };

  const services: ServiceCard[] = [
    { name: "PostgreSQL", icon: Database, status: resolveStatus("postgres"), latency: resolveLatency("postgres"), error: resolveError("postgres") },
    { name: "Redis", icon: Database, status: resolveStatus("redis"), latency: resolveLatency("redis"), error: resolveError("redis") },
    { name: "MinIO", icon: HardDrive, status: resolveStatus("minio"), latency: resolveLatency("minio"), error: resolveError("minio") },
    { name: "MQTT", icon: Radio, status: resolveStatus("mqtt"), latency: resolveLatency("mqtt"), error: resolveError("mqtt") },
  ];

  const overallStatus = health?.status === "ok" || health?.status === "healthy" ? "healthy" :
    health?.status === "degraded" ? "degraded" :
    health ? "down" : "unknown";

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-red-400" />
            System Health
          </h1>
          <p className="text-slate-400 mt-1">
            Infrastructure service status and metrics
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-800 rounded w-20 mb-3" />
                <div className="h-8 bg-slate-800 rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Overall Status Banner */}
          <Card className={`${statusConfig[overallStatus].color} border mb-6`}>
            <CardContent className="p-4 flex items-center gap-3">
              {(() => {
                const StatusIcon = statusConfig[overallStatus].icon;
                return <StatusIcon className={`w-6 h-6 ${statusConfig[overallStatus].iconColor}`} />;
              })()}
              <div>
                <p className="text-sm font-medium text-white">
                  System Status: <span className="capitalize">{overallStatus}</span>
                </p>
                {health?.timestamp && (
                  <p className="text-xs text-slate-500">
                    Last checked: {new Date(health.timestamp as string).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {services.map((svc) => {
              const config = statusConfig[svc.status];
              const Icon = svc.icon;
              const StatusIcon = config.icon;

              return (
                <Card key={svc.name} className={`${config.color} border`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Icon className="w-8 h-8 text-slate-400" />
                      <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{svc.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${config.badge}`}>
                        {svc.status}
                      </span>
                      {svc.latency !== undefined && (
                        <span className="text-xs text-slate-500">{svc.latency}ms</span>
                      )}
                    </div>
                    {svc.error && (
                      <p className="text-xs text-red-400 mt-2 truncate" title={svc.error}>
                        {svc.error}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Raw Metrics */}
          {metrics && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Raw Metrics</h2>
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-6">
                  <pre className="text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(metrics, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
