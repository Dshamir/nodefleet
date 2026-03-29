"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, TrendingUp, Building2, Users } from "lucide-react";

interface PlanDistribution {
  plan: string;
  count: number;
}

interface SubscriptionData {
  distribution: PlanDistribution[];
  activeSubscriptions: number;
  totalOrganizations: number;
  estimatedMRR: number;
}

const planConfig: Record<string, { color: string; price: string; icon: string }> = {
  free: { color: "border-slate-700 bg-slate-900/50", price: "$0", icon: "text-slate-400" },
  pro: { color: "border-blue-500/30 bg-blue-500/10", price: "$29", icon: "text-blue-400" },
  team: { color: "border-purple-500/30 bg-purple-500/10", price: "$79", icon: "text-purple-400" },
  enterprise: { color: "border-red-500/30 bg-red-500/10", price: "$199", icon: "text-red-400" },
};

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/subscriptions")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-red-400" />
            Subscriptions
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-800 rounded w-20 mb-3" />
                <div className="h-8 bg-slate-800 rounded w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getCount = (plan: string) =>
    data.distribution.find((d) => d.plan === plan)?.count || 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-red-400" />
          Subscriptions
        </h1>
        <p className="text-slate-400 mt-1">
          Plan distribution and revenue overview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Estimated MRR</p>
                <p className="text-3xl font-bold text-green-400 mt-1">
                  ${data.estimatedMRR.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Subscriptions</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {data.activeSubscriptions}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-400 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Organizations</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {data.totalOrganizations}
                </p>
              </div>
              <Building2 className="w-8 h-8 text-cyan-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      <h2 className="text-lg font-semibold text-white mb-4">Plan Distribution</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {["free", "pro", "team", "enterprise"].map((plan) => {
          const config = planConfig[plan];
          const count = getCount(plan);
          const pct = data.totalOrganizations > 0
            ? Math.round((count / data.totalOrganizations) * 100)
            : 0;

          return (
            <Card key={plan} className={`${config.color} border`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
                    {plan}
                  </h3>
                  <span className="text-xs text-slate-500">{config.price}/mo</span>
                </div>
                <p className="text-3xl font-bold text-white">{count}</p>
                <div className="mt-3">
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-red-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{pct}% of total</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
