"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Eye, MousePointerClick, Users } from "lucide-react";

interface AnalyticsData {
  totalPageViews: number;
  totalEvents: number;
  uniqueSessions: number;
  topPages: { path: string; views: number }[];
  topEvents: { name: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/overview")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Page Views", value: data?.totalPageViews || 0, icon: Eye, color: "text-blue-400" },
    { label: "Events", value: data?.totalEvents || 0, icon: MousePointerClick, color: "text-green-400" },
    { label: "Unique Sessions", value: data?.uniqueSessions || 0, icon: Users, color: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Analytics
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Track page views, events, and user sessions.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-24" />
                  <div className="h-8 bg-slate-800 rounded w-16" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{card.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {card.value.toLocaleString()}
                    </p>
                  </div>
                  <card.icon className={`w-8 h-8 ${card.color}`} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Pages & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex justify-between">
                    <div className="h-4 bg-slate-800 rounded w-48" />
                    <div className="h-4 bg-slate-800 rounded w-12" />
                  </div>
                ))}
              </div>
            ) : data?.topPages && data.topPages.length > 0 ? (
              <div className="space-y-3">
                {data.topPages.map((page, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300 truncate max-w-[300px]">
                      {page.path}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {Number(page.views).toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">
                No page view data yet. Analytics data will appear as traffic arrives.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Top Events</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex justify-between">
                    <div className="h-4 bg-slate-800 rounded w-48" />
                    <div className="h-4 bg-slate-800 rounded w-12" />
                  </div>
                ))}
              </div>
            ) : data?.topEvents && data.topEvents.length > 0 ? (
              <div className="space-y-3">
                {data.topEvents.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{ev.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {Number(ev.count).toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">
                No events tracked yet. Events will appear when your tracking is configured.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
