"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, Plus, Loader2, CheckCircle2, Clock } from "lucide-react";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
  primary: boolean;
  sslStatus: string | null;
  dnsRecords: Record<string, unknown> | null;
  createdAt: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  const fetchDomains = () => {
    setLoading(true);
    fetch("/api/domains")
      .then((r) => r.json())
      .then((res) => setDomains(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (res.ok) {
        setNewDomain("");
        fetchDomains();
      }
    } catch (err) {
      console.error("Failed to add domain:", err);
    }
    setAdding(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" /> Custom Domains
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Connect your own domains with automatic SSL and DNS verification.
        </p>
      </div>

      {/* Add Domain */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Input
              className="bg-slate-800 border-slate-700 text-white flex-1"
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={adding || !newDomain.trim()}>
              {adding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Domain
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Domain List */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Domain</TableHead>
                <TableHead className="text-slate-400 w-32">Status</TableHead>
                <TableHead className="text-slate-400 w-32">SSL</TableHead>
                <TableHead className="text-slate-400 w-32">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><div className="h-4 bg-slate-800 rounded w-48 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-slate-800 rounded w-20 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-slate-800 rounded w-16 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-slate-800 rounded w-24 animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    No custom domains configured. Add one above to get started.
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((d) => (
                  <TableRow key={d.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-white font-medium">
                      {d.domain}
                      {d.primary && (
                        <Badge variant="secondary" className="ml-2 text-xs">Primary</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.verified ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-yellow-400 text-xs">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          d.sslStatus === "active"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {d.sslStatus || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
