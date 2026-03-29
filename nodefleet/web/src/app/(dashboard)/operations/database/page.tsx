"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, HardDrive, RefreshCw, Plug } from "lucide-react";

interface TableInfo {
  name: string;
  rowCount: number;
  totalSize: string;
  totalBytes: number;
}

interface DbHealth {
  databaseSize: string;
  databaseSizeBytes: number;
  activeConnections: number;
  tables: TableInfo[];
}

export default function DatabaseHealthPage() {
  const [data, setData] = useState<DbHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/operations/database")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statCards = [
    { label: "Database Size", value: data?.databaseSize || "--", icon: HardDrive, color: "text-blue-400" },
    { label: "Active Connections", value: data?.activeConnections ?? "--", icon: Plug, color: "text-green-400" },
    { label: "Total Tables", value: data?.tables?.length ?? "--", icon: Database, color: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" /> Database Health
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor table sizes, row counts, and connection status.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Stats */}
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
                    <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                  </div>
                  <card.icon className={`w-8 h-8 ${card.color}`} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table List */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Tables</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Table Name</TableHead>
                <TableHead className="text-slate-400 text-right w-32">Rows</TableHead>
                <TableHead className="text-slate-400 text-right w-32">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><div className="h-4 bg-slate-800 rounded w-48 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-slate-800 rounded w-16 animate-pulse ml-auto" /></TableCell>
                    <TableCell><div className="h-4 bg-slate-800 rounded w-16 animate-pulse ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.tables && data.tables.length > 0 ? (
                data.tables.map((t) => (
                  <TableRow key={t.name} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-white font-mono text-sm">{t.name}</TableCell>
                    <TableCell className="text-right text-slate-300 text-sm">
                      {t.rowCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-xs">{t.totalSize}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                    No table data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
