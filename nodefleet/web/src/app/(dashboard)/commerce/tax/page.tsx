"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileX2 } from "lucide-react";

export default function TaxExemptionsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/commerce/tax-exemptions")
      .then((r) => r.json())
      .then((res) => setData(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileX2 className="w-6 h-6 text-primary" /> Tax Exemptions
        </h1>
        <p className="text-slate-400 text-sm mt-1">Manage tax rates, regions, and exemptions.</p>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="py-12 text-center">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-800 rounded w-48 mx-auto" />
              <div className="h-4 bg-slate-800 rounded w-32 mx-auto" />
            </div>
          ) : data.length === 0 ? (
            <div>
              <FileX2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No tax exemptions yet</p>
              <p className="text-slate-500 text-sm mt-1">Manage tax rates, regions, and exemptions.</p>
            </div>
          ) : (
            <p className="text-slate-400">{data.length} tax exemptions found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
