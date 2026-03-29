"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface ScoringRule {
  id: string;
  name: string;
  field: string;
  operator: string;
  value: string;
  points: number;
  enabled: boolean;
  createdAt: string;
}

export default function LeadScoringPage() {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/lead-scoring")
      .then((r) => r.json())
      .then((data) => setRules(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" /> Lead Scoring
        </h1>
        <p className="text-slate-400 text-sm mt-1">Configure rules to automatically score and prioritize leads.</p>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Rule Name</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Field</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Condition</th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4">Points</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-32 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-28 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-12 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></td>
                    </tr>
                  ))
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No scoring rules yet</p>
                      <p className="text-slate-500 text-sm mt-1">Add rules to automatically score incoming leads.</p>
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer">
                      <td className="p-4 text-sm text-white font-medium">{rule.name}</td>
                      <td className="p-4 text-sm text-slate-300 font-mono">{rule.field}</td>
                      <td className="p-4 text-sm text-slate-400">
                        {rule.operator} <span className="text-slate-300">{rule.value}</span>
                      </td>
                      <td className="p-4 text-right text-sm font-medium">
                        <span className={rule.points >= 0 ? "text-green-400" : "text-red-400"}>
                          {rule.points >= 0 ? "+" : ""}{rule.points}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge className={rule.enabled ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"}>
                          {rule.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
