"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

interface LeadForm {
  id: string;
  name: string;
  slug: string;
  status: string;
  submissions: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  inactive: "bg-slate-500/20 text-slate-400",
  draft: "bg-yellow-500/20 text-yellow-400",
};

export default function LeadFormsPage() {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm/lead-forms")
      .then((r) => r.json())
      .then((data) => setForms(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" /> Lead Forms
        </h1>
        <p className="text-slate-400 text-sm mt-1">Manage lead capture forms and track submissions.</p>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Form Name</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Slug</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Status</th>
                  <th className="text-right text-xs text-slate-400 font-medium p-4">Submissions</th>
                  <th className="text-left text-xs text-slate-400 font-medium p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-32 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-24 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-12 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : forms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No lead forms yet</p>
                      <p className="text-slate-500 text-sm mt-1">Create a form to start capturing leads.</p>
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => (
                    <tr key={form.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer">
                      <td className="p-4 text-sm text-white font-medium">{form.name}</td>
                      <td className="p-4 text-sm text-slate-300 font-mono">{form.slug}</td>
                      <td className="p-4">
                        <Badge className={`capitalize ${statusColors[form.status] || "bg-slate-500/20 text-slate-400"}`}>
                          {form.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right text-sm text-white font-medium">{form.submissions}</td>
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(form.createdAt).toLocaleDateString()}
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
