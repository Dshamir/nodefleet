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
  BookOpen,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  Eye,
  Calendar,
  FolderOpen,
  BarChart3,
  Edit,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KbArticle {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  categoryId: string | null;
  categoryName: string | null;
  status: string;
  views: number;
  createdAt: string;
  updatedAt: string;
}

interface KbCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

interface KbStats {
  total: number;
  published: number;
  draft: number;
  totalViews: number;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [stats, setStats] = useState<KbStats>({ total: 0, published: 0, draft: 0, totalViews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<KbArticle | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formStatus, setFormStatus] = useState("draft");

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      const res = await fetch(`/api/knowledge-base?${params}`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      const json = await res.json();
      setArticles(json.data || []);
      if (json.stats) setStats(json.stats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-base?type=categories");
      if (!res.ok) return;
      const json = await res.json();
      setCategories(json.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [fetchArticles, fetchCategories]);

  function openCreate() {
    setEditArticle(null);
    setFormTitle("");
    setFormSlug("");
    setFormContent("");
    setFormCategoryId("");
    setFormStatus("draft");
    setDialogOpen(true);
  }

  function openEdit(article: KbArticle) {
    setEditArticle(article);
    setFormTitle(article.title);
    setFormSlug(article.slug);
    setFormContent(article.content || "");
    setFormCategoryId(article.categoryId || "");
    setFormStatus(article.status);
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          slug: formSlug,
          content: formContent || undefined,
          categoryId: formCategoryId || undefined,
          status: formStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save article");
      }
      setDialogOpen(false);
      await fetchArticles();
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
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Base</h1>
          <p className="text-slate-400">
            Manage articles and documentation
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          New Article
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">Total Articles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.published}</p>
                <p className="text-xs text-slate-400">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Edit className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.draft}</p>
                <p className="text-xs text-slate-400">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalViews.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4 flex-col sm:flex-row">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search articles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
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
          <span className="ml-3 text-slate-400">Loading articles...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && articles.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No articles found</p>
            <p className="text-slate-500 text-sm mt-1">
              Create your first knowledge base article
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              New Article
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Article List */}
      {!loading && articles.length > 0 && (
        <div className="space-y-3">
          {articles.map((article) => (
            <Card
              key={article.id}
              className="bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => openEdit(article)}
            >
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white truncate">
                        {article.title}
                      </h3>
                      <StatusBadge status={article.status} />
                      {article.categoryName && (
                        <Badge className="text-xs bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                          {article.categoryName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {article.views} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(article.createdAt)}
                      </span>
                      <span className="font-mono text-xs text-slate-600">
                        /{article.slug}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <Edit className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Item count */}
      {!loading && !error && articles.length > 0 && (
        <p className="text-sm text-slate-400">
          Showing {articles.length} article{articles.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editArticle ? "Edit Article" : "Create New Article"}
            </DialogTitle>
            <DialogDescription>
              {editArticle
                ? "Update the article content and settings"
                : "Write a new knowledge base article"}
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
                    if (!editArticle) setFormSlug(slugify(e.target.value));
                  }}
                  placeholder="Article title"
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
                  placeholder="article-slug"
                  className="bg-slate-800 border-slate-700 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Category
                </label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
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
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Content (Markdown)
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Write your article content in Markdown..."
                rows={12}
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
                {editArticle ? "Update Article" : "Create Article"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
