"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, RefreshCw, Activity } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency: number | null;
  url: string;
}

const STATUS_COLORS = {
  healthy: "bg-emerald-500/20 text-emerald-400",
  degraded: "bg-yellow-500/20 text-yellow-400",
  down: "bg-red-500/20 text-red-400",
};

export default function NetworkStatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setMqttStatus] = useState<Record<string, unknown> | null>(null);

  const checkServices = async () => {
    setLoading(true);
    const checks: ServiceStatus[] = [];

    // Check API health
    try {
      const start = Date.now();
      const res = await fetch("/api/health");
      const latency = Date.now() - start;
      checks.push({
        name: "API Server",
        status: res.ok ? "healthy" : "degraded",
        latency,
        url: "/api/health",
      });
    } catch {
      checks.push({ name: "API Server", status: "down", latency: null, url: "/api/health" });
    }

    // Check MQTT
    try {
      const start = Date.now();
      const res = await fetch("/api/mqtt/status");
      const latency = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        setMqttStatus(data);
        checks.push({
          name: "MQTT Broker",
          status: data.connected ? "healthy" : "degraded",
          latency,
          url: "/api/mqtt/status",
        });
      } else {
        checks.push({ name: "MQTT Broker", status: "degraded", latency, url: "/api/mqtt/status" });
      }
    } catch {
      checks.push({ name: "MQTT Broker", status: "down", latency: null, url: "/api/mqtt/status" });
    }

    // Check Database (via metrics)
    try {
      const start = Date.now();
      const res = await fetch("/api/metrics");
      const latency = Date.now() - start;
      checks.push({
        name: "Database",
        status: res.ok ? "healthy" : "degraded",
        latency,
        url: "/api/metrics",
      });
    } catch {
      checks.push({ name: "Database", status: "down", latency: null, url: "/api/metrics" });
    }

    setServices(checks);
    setLoading(false);
  };

  useEffect(() => {
    checkServices();
  }, []);

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const overallStatus =
    services.length === 0
      ? "checking"
      : healthyCount === services.length
      ? "All Systems Operational"
      : healthyCount > 0
      ? "Partial Degradation"
      : "Major Outage";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" /> Network Status
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time health check of all system services.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={checkServices} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Check Now
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card
        className={`border ${
          overallStatus === "All Systems Operational"
            ? "bg-emerald-900/20 border-emerald-800/50"
            : overallStatus === "Partial Degradation"
            ? "bg-yellow-900/20 border-yellow-800/50"
            : "bg-slate-900/50 border-slate-800"
        }`}
      >
        <CardContent className="p-6 flex items-center gap-4">
          <Activity
            className={`w-8 h-8 ${
              overallStatus === "All Systems Operational"
                ? "text-emerald-400"
                : overallStatus === "Partial Degradation"
                ? "text-yellow-400"
                : "text-slate-400"
            }`}
          />
          <div>
            <p className="text-white font-semibold text-lg">{overallStatus}</p>
            <p className="text-slate-400 text-sm">
              {loading
                ? "Running health checks..."
                : `${healthyCount}/${services.length} services healthy`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading
          ? [...Array(3)].map((_, i) => (
              <Card key={i} className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 bg-slate-800 rounded w-32" />
                    <div className="h-4 bg-slate-800 rounded w-20" />
                    <div className="h-4 bg-slate-800 rounded w-24" />
                  </div>
                </CardContent>
              </Card>
            ))
          : services.map((svc) => (
              <Card
                key={svc.name}
                className={`border transition-colors ${
                  svc.status === "healthy"
                    ? "bg-slate-900/50 border-emerald-800/30"
                    : svc.status === "degraded"
                    ? "bg-slate-900/50 border-yellow-800/30"
                    : "bg-slate-900/50 border-red-800/30"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold">{svc.name}</h3>
                    <Badge variant="secondary" className={STATUS_COLORS[svc.status]}>
                      {svc.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    {svc.latency !== null && <p>Latency: {svc.latency}ms</p>}
                    <p className="font-mono">{svc.url}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
