"use client";

import { useState, useEffect } from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  MapPin,
  FileText,
  HardDrive,
  Loader2,
  Wifi,
  Server,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  mediaFiles: number;
  storageUsed: string;
}

interface ActivityItem {
  id: string;
  device: string;
  action: string;
  time: string;
  status: "success" | "warning" | "error";
}

interface Fleet {
  id: string;
  name: string;
  location: string;
  deviceCount: number;
}

function formatStorageUsed(bytes: number): string {
  if (typeof bytes !== "number") return String(bytes);
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);

        const [statsRes, fleetsRes] = await Promise.allSettled([
          fetch("/api/dashboard/stats"),
          fetch("/api/fleets"),
        ]);

        // Process stats response
        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const data = await statsRes.value.json();
          setStats(data.stats || {
            totalDevices: 0,
            onlineDevices: 0,
            mediaFiles: 0,
            storageUsed: "0 B",
          });
          setActivity(data.activity || []);
        } else {
          setStats({
            totalDevices: 0,
            onlineDevices: 0,
            mediaFiles: 0,
            storageUsed: "0 B",
          });
        }

        // Process fleets response
        if (fleetsRes.status === "fulfilled" && fleetsRes.value.ok) {
          const data = await fleetsRes.value.json();
          setFleets(data.data || data.fleets || data || []);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load dashboard";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-slate-400">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const storageDisplay =
    typeof stats?.storageUsed === "number"
      ? formatStorageUsed(stats.storageUsed as unknown as number)
      : stats?.storageUsed || "0 B";

  const statCards = [
    {
      title: "Total Devices",
      value: String(stats?.totalDevices ?? 0),
      icon: Activity,
      color: "primary" as const,
    },
    {
      title: "Online Now",
      value: String(stats?.onlineDevices ?? 0),
      icon: Wifi,
      color: "success" as const,
    },
    {
      title: "Media Files",
      value: String(stats?.mediaFiles ?? 0),
      icon: FileText,
      color: "warning" as const,
    },
    {
      title: "Storage Used",
      value: storageDisplay,
      icon: HardDrive,
      color: "primary" as const,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome back. Here is your fleet overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* Fleet Summary */}
      {fleets.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Your Fleets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleets.map((fleet) => (
              <Card
                key={fleet.id}
                className="bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-all"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Server className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{fleet.name}</h3>
                        {fleet.location && (
                          <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {fleet.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs">
                      {fleet.deviceCount ?? 0} device{(fleet.deviceCount ?? 0) !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">No recent activity</p>
                <p className="text-sm text-slate-500 mt-1">
                  Activity from your devices will appear here
                </p>
                <Link href="/devices">
                  <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary-light transition-colors">
                    Go to Devices <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-800"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-white">{item.device}</p>
                      <p className="text-sm text-slate-400">{item.action}</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          item.status === "success"
                            ? "success"
                            : item.status === "warning"
                            ? "warning"
                            : "destructive"
                        }
                        className="mb-1"
                      >
                        {item.status === "success"
                          ? "Success"
                          : item.status === "warning"
                          ? "Warning"
                          : "Error"}
                      </Badge>
                      <p className="text-xs text-slate-500">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
