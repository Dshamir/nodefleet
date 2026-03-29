"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, ChevronLeft, ChevronRight, Tag } from "lucide-react";

interface VersionRelease {
  id: string;
  version: string;
  status: string;
  releaseNotes: string | null;
  changelog: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400",
  rc: "bg-yellow-500/20 text-yellow-400",
  released: "bg-green-500/20 text-green-400",
  deprecated: "bg-red-500/20 text-red-400",
};

export default function VersionControlPage() {
  const [releases, setReleases] = useState<VersionRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/dev/versions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setReleases(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-primary" /> Version Control
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} total releases</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "draft", "rc", "released", "deprecated"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className="capitalize"
          >
            {s === "rc" ? "Release Candidate" : s}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-slate-800 rounded w-32" />
                  <div className="h-4 bg-slate-800 rounded w-64" />
                  <div className="h-3 bg-slate-800 rounded w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : releases.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="py-12 text-center">
              <GitBranch className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-500">No version releases found</p>
              <p className="text-xs text-slate-600 mt-1">Create a release to start tracking firmware versions.</p>
            </CardContent>
          </Card>
        ) : (
          releases.map((release) => (
            <Card key={release.id} className="bg-slate-900/50 border-slate-800 hover:bg-slate-800/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Tag className="w-4 h-4 text-slate-400" />
                      <span className="text-lg font-bold text-white font-mono">{release.version}</span>
                      <Badge className={`capitalize ${statusColors[release.status] || "bg-slate-500/20 text-slate-400"}`}>
                        {release.status === "rc" ? "Release Candidate" : release.status}
                      </Badge>
                    </div>
                    {release.releaseNotes && (
                      <p className="text-sm text-slate-300 mb-2">{release.releaseNotes}</p>
                    )}
                    {release.changelog && (
                      <pre className="text-xs text-slate-500 mt-2 whitespace-pre-wrap font-mono bg-slate-950/50 p-3 rounded border border-slate-800 max-h-40 overflow-y-auto">
                        {release.changelog}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 ml-4 whitespace-nowrap">
                    {new Date(release.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / limit)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
