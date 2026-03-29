"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Cpu, DollarSign, Activity, AlertCircle } from "lucide-react";

interface PlatformStats {
  totalOrgs: number;
  totalUsers: number;
  totalDevices: number;
  onlineDevices: number;
  mrr: string;
  systemHealth: string;
}

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load stats");
        return res.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const statCards = stats
    ? [
        { label: "Organizations", value: stats.totalOrgs, icon: Building2, color: "text-blue-400" },
        { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-green-400" },
        { label: "Total Devices", value: stats.totalDevices, icon: Cpu, color: "text-cyan-400" },
        { label: "Online Devices", value: stats.onlineDevices, icon: Activity, color: "text-emerald-400" },
        { label: "MRR", value: stats.mrr, icon: DollarSign, color: "text-yellow-400" },
        { label: "System Health", value: stats.systemHealth, icon: Activity, color: "text-green-400" },
      ]
    : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
        <p className="text-slate-400 mt-1">SaaS operator overview — all organizations and subscribers</p>
      </div>

      {!stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-800 rounded w-24 mb-2" />
                <div className="h-8 bg-slate-800 rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{card.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                    </div>
                    <Icon className={`w-8 h-8 ${card.color} opacity-60`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
