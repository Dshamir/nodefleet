"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Globe,
  Link2,
  Calendar,
  Edit,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  status: string;
  content: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const PAGE_TYPES = ["home", "about", "contact", "footer", "custom"];
const STATUSES = ["draft", "published", "archived"];

const TYPE_COLORS: Record<string, string> = {
  home: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  about: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  contact: "bg-green-500/20 text-green-400 border-green-500/30",
  footer: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  custom: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CmsManagerPage() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPage, setEditPage] = useState<CmsPage | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formType, setFormType] = useState("custom");
  const [formStatus, setFormStatus] = useState("draft");
  const [formContent, setFormContent] = useState("");

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/content/cms?${params}`);
      if (!res.ok) throw new Error("Failed to fetch pages");
      const json = await res.json();
      setPages(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  function openCreate() {
    setEditPage(null);
    setFormTitle("");
    setFormSlug("");
    setFormType("custom");
    setFormStatus("draft");
    setFormContent("");
    setDialogOpen(true);
  }

  function openEdit(page: CmsPage) {
    setEditPage(page);
    setFormTitle(page.title);
    setFormSlug(page.slug);
    setFormType(page.pageType);
    setFormStatus(page.status);
    setFormContent(page.content || "");
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        title: formTitle,
        slug: formSlug,
        pageType: formType,
        status: formStatus,
        content: formContent,
      };

      const res = await fetch("/api/content/cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save page");
      }

      setDialogOpen(false);
      await fetchPages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">CMS Pages</h1>
          <p className="text-slate-400">
            Manage website pages and content
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          New Page
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4 flex-col sm:flex-row">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search pages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
                <SelectValue placeholder="Page type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PAGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FilterTabs
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-400">Loading pages...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && pages.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No pages found</p>
            <p className="text-slate-500 text-sm mt-1">
              Create your first CMS page to get started
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              New Page
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Page Cards */}
      {!loading && pages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <Card
              key={page.id}
              className="bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => openEdit(page)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-white truncate">
                      {page.title}
                    </h3>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="truncate">/{page.slug}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <StatusBadge status={page.status} />
                  <Badge
                    className={`text-xs border capitalize ${
                      TYPE_COLORS[page.pageType] || TYPE_COLORS.custom
                    }`}
                  >
                    {page.pageType}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(page.createdAt)}</span>
                  {page.publishedAt && (
                    <span className="ml-2 text-green-400">
                      Published {formatDate(page.publishedAt)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Item count */}
      {!loading && !error && pages.length > 0 && (
        <p className="text-sm text-slate-400">
          Showing {pages.length} page{pages.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editPage ? "Edit Page" : "Create New Page"}
            </DialogTitle>
            <DialogDescription>
              {editPage
                ? "Update the page details below"
                : "Fill in the page details to create a new CMS page"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Title
                </label>
                <Input
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    if (!editPage) setFormSlug(slugify(e.target.value));
                  }}
                  placeholder="Page title"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Slug
                </label>
                <Input
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="page-slug"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Type
                </label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Status
                </label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Content
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Page content (HTML or Markdown)..."
                rows={10}
                className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formTitle || !formSlug}
                className="gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editPage ? "Update Page" : "Create Page"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
