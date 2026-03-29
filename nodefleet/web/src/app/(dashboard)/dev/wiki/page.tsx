"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, FileText, FolderOpen } from "lucide-react";

interface WikiPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function DevWikiPage() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [parentStack, setParentStack] = useState<Array<{ id: string; title: string }>>([]);

  const currentParentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (currentParentId) {
      params.set("parentId", currentParentId);
    } else {
      params.set("root", "true");
    }

    fetch(`/api/dev/wiki?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPages(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentParentId]);

  const navigateInto = (page: WikiPage) => {
    setParentStack([...parentStack, { id: page.id, title: page.title }]);
  };

  const navigateTo = (index: number) => {
    if (index < 0) {
      setParentStack([]);
    } else {
      setParentStack(parentStack.slice(0, index + 1));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Dev Wiki
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} pages at this level</p>
        </div>
      </div>

      {/* Breadcrumb */}
      {parentStack.length > 0 && (
        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateTo(-1)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Root
          </button>
          {parentStack.map((crumb, idx) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <button
                onClick={() => navigateTo(idx)}
                className={`transition-colors ${
                  idx === parentStack.length - 1
                    ? "text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {crumb.title}
              </button>
            </span>
          ))}
        </nav>
      )}

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="animate-pulse flex items-center gap-3">
                  <div className="h-5 w-5 bg-slate-800 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-48" />
                    <div className="h-3 bg-slate-800 rounded w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : pages.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-500">No wiki pages found</p>
              <p className="text-xs text-slate-600 mt-1">Create a wiki page to start documenting your project.</p>
            </CardContent>
          </Card>
        ) : (
          pages.map((wikiPage) => (
            <Card
              key={wikiPage.id}
              className="bg-slate-900/50 border-slate-800 hover:bg-slate-800/30 cursor-pointer transition-colors"
              onClick={() => navigateInto(wikiPage)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-white font-medium">{wikiPage.title}</p>
                      <p className="text-xs text-slate-500 font-mono">/{wikiPage.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {new Date(wikiPage.updatedAt || wikiPage.createdAt).toLocaleDateString()}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
                {wikiPage.content && (
                  <p className="text-xs text-slate-500 mt-2 truncate max-w-lg ml-8">
                    {wikiPage.content.slice(0, 120)}...
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
