"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
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
  FileCode,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Variable,
  Hash,
  Tag,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptTemplate {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  content: string;
  variables: string[] | null;
  isActive: boolean;
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

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  const vars = matches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  return [...new Set(vars)];
}

const CATEGORIES = ["general", "support", "sales", "onboarding", "notification", "system"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptTemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<PromptTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formContent, setFormContent] = useState("");
  const [detectedVars, setDetectedVars] = useState<string[]>([]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/ai/prompt-templates?${params}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      const json = await res.json();
      setTemplates(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Auto-extract variables from content
  useEffect(() => {
    setDetectedVars(extractVariables(formContent));
  }, [formContent]);

  function openCreate() {
    setEditTemplate(null);
    setFormName("");
    setFormSlug("");
    setFormCategory("");
    setFormContent("");
    setDialogOpen(true);
  }

  function openEdit(tmpl: PromptTemplate) {
    setEditTemplate(tmpl);
    setFormName(tmpl.name);
    setFormSlug(tmpl.slug);
    setFormCategory(tmpl.category || "");
    setFormContent(tmpl.content);
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/ai/prompt-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          slug: formSlug,
          category: formCategory || undefined,
          content: formContent,
          variables: detectedVars.length > 0 ? detectedVars : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save template");
      }
      setDialogOpen(false);
      await fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filteredTemplates = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Prompt Templates
          </h1>
          <p className="text-slate-400">
            Manage reusable prompt templates with variable extraction
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
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
          <span className="ml-3 text-slate-400">Loading templates...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && filteredTemplates.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <FileCode className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No templates found</p>
            <p className="text-slate-500 text-sm mt-1">
              Create your first prompt template
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Template Table */}
      {!loading && filteredTemplates.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Variables
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredTemplates.map((tmpl) => (
                  <tr
                    key={tmpl.id}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => openEdit(tmpl)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-primary" />
                        <span className="text-white font-medium">
                          {tmpl.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm font-mono">
                      {tmpl.slug}
                    </td>
                    <td className="px-6 py-4">
                      {tmpl.category ? (
                        <Badge className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30 capitalize">
                          {tmpl.category}
                        </Badge>
                      ) : (
                        <span className="text-slate-500 text-sm">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Variable className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-sm text-slate-400">
                          {tmpl.variables?.length || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={tmpl.isActive ? "active" : "inactive"}
                      />
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      {formatDate(tmpl.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editTemplate ? "Edit Template" : "Create Prompt Template"}
            </DialogTitle>
            <DialogDescription>
              {editTemplate
                ? "Update the template content and settings"
                : "Define a reusable prompt template. Use {{variable}} syntax for dynamic values."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Name
                </label>
                <Input
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!editTemplate) setFormSlug(slugify(e.target.value));
                  }}
                  placeholder="Customer Welcome"
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
                  placeholder="customer-welcome"
                  className="bg-slate-800 border-slate-700 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Category
              </label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Template Content
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="You are a {{role}} assistant. Help the user with {{task}}..."
                rows={8}
                className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono"
              />
            </div>

            {/* Detected Variables */}
            {detectedVars.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Variable className="w-4 h-4" />
                  Detected Variables ({detectedVars.length})
                </label>
                <div className="flex gap-2 flex-wrap">
                  {detectedVars.map((v) => (
                    <Badge
                      key={v}
                      className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/30 font-mono"
                    >
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

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
                disabled={saving || !formName || !formSlug || !formContent}
                className="gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editTemplate ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
