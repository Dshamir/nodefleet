"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, Users, Target, ClipboardList, TrendingUp } from "lucide-react";

interface CrmStats {
  contacts: number;
  leads: number;
}

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<CrmStats>({ contacts: 0, leads: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/contacts").then((r) => r.json()),
      fetch("/api/crm/leads").then((r) => r.json()),
    ])
      .then(([contactsRes, leadsRes]) => {
        setStats({
          contacts: contactsRes.pagination?.total || contactsRes.data?.length || 0,
          leads: leadsRes.pagination?.total || leadsRes.data?.length || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Total Contacts", value: stats.contacts, icon: Users, href: "/crm/contacts", color: "text-blue-400" },
    { label: "Active Leads", value: stats.leads, icon: Target, href: "/crm/leads", color: "text-green-400" },
    { label: "Lead Forms", value: "--", icon: ClipboardList, href: "/crm/lead-forms", color: "text-purple-400" },
    { label: "Scoring Rules", value: "--", icon: TrendingUp, href: "/crm/lead-scoring", color: "text-amber-400" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCircle className="w-6 h-6 text-primary" /> CRM
        </h1>
        <p className="text-slate-400 text-sm mt-1">Customer relationship management overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="bg-slate-900/50 border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
            onClick={() => (window.location.href = card.href)}
          >
            <CardContent className="p-6">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-24" />
                  <div className="h-8 bg-slate-800 rounded w-16" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">{card.label}</span>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
