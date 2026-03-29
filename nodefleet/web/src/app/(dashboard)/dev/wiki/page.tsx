"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import {
  BookOpen,
  Plus,
  ArrowLeft,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  RefreshCw,
} from "lucide-react";

/* ---------- Types ---------- */

interface WikiPage {
  id: string;
  title: string;
  slug: string;
  section?: string;
  content: string | null;
  parentId: string | null;
  sortOrder: number;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Constants ---------- */

const SECTIONS = [
  { key: "getting-started", label: "Getting Started" },
  { key: "architecture", label: "Architecture" },
  { key: "api-reference", label: "API Reference" },
  { key: "guides", label: "Guides" },
  { key: "troubleshooting", label: "Troubleshooting" },
  { key: "deployment", label: "Deployment" },
  { key: "security", label: "Security" },
  { key: "infrastructure", label: "Infrastructure" },
];

const SECTION_COLORS: Record<string, string> = {
  "getting-started": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  architecture: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "api-reference": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  guides: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  troubleshooting: "bg-red-500/20 text-red-400 border-red-500/30",
  deployment: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  security: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  infrastructure: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const DEFAULT_BADGE = "bg-slate-500/20 text-slate-400 border-slate-500/30";

/* ---------- Page ---------- */

type ViewMode = "list" | "read";

export default function DevWikiPage() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [activeSection, setActiveSection] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const fetchPages = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ limit: "200" });
    if (activeSection) params.set("section", activeSection);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/dev/wiki?${params}`)
      .then((r) => r.json())
      .then((data) => setPages(data.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [activeSection, debouncedSearch]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  /* Open article view */
  const openArticle = (page: WikiPage) => {
    setSelectedPage(page);
    setViewMode("read");
  };

  const backToList = () => {
    setViewMode("list");
    setSelectedPage(null);
  };

  /* Editor drawer */
  const openCreate = () => {
    setDrawerMode("create");
    setDrawerOpen(true);
  };

  const openEdit = (page: WikiPage) => {
    setSelectedPage(page);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    fetchPages();
  };

  /* Delete */
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this wiki page?")) return;
    try {
      const res = await fetch(`/api/dev/wiki/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPages((prev) => prev.filter((p) => p.id !== id));
        if (selectedPage?.id === id) {
          setSelectedPage(null);
          setViewMode("list");
        }
      }
    } catch {
      // silent
    }
  };

  /* Highlight search terms */
  const highlightTitle = (title: string) => {
    if (!debouncedSearch) return title;
    try {
      const regex = new RegExp(
        `(${debouncedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      );
      const parts = title.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-500/30 text-yellow-300 rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return title;
    }
  };

  /* ---- Read View ---- */
  if (viewMode === "read" && selectedPage) {
    return (
      <div className="space-y-6">
        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={backToList}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to list
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(selectedPage)}
            >
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(selectedPage.id)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
        </div>

        {/* Article */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              {selectedPage.section && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    SECTION_COLORS[selectedPage.section] || DEFAULT_BADGE
                  }`}
                >
                  {SECTIONS.find((s) => s.key === selectedPage.section)
                    ?.label || selectedPage.section}
                </span>
              )}
              <span className="text-xs text-slate-500 font-mono">
                /{selectedPage.slug}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-2 mb-1">
              {selectedPage.title}
            </h1>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-6">
              <span>{selectedPage.author || "System"}</span>
              <span>&middot;</span>
              <span>
                Updated{" "}
                {new Date(selectedPage.updatedAt).toLocaleDateString()}
              </span>
            </div>

            {/* Rendered content */}
            <div className="prose prose-invert prose-sm max-w-none">
              {selectedPage.content ? (
                <div className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">
                  {selectedPage.content}
                </div>
              ) : (
                <p className="text-slate-500 italic">No content yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Editor drawer overlay */}
        {drawerOpen && (
          <EditorDrawer
            page={drawerMode === "edit" ? selectedPage : null}
            onClose={closeDrawer}
          />
        )}
      </div>
    );
  }

  /* ---- List View ---- */
  return (
    <div className="flex gap-6">
      {/* Left Sidebar */}
      <div className="w-[200px] flex-shrink-0 hidden md:block">
        <Card className="p-3 space-y-1">
          <button
            onClick={() => setActiveSection("")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              activeSection === ""
                ? "bg-primary/20 text-primary font-medium"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            All
          </button>
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === s.key
                  ? "bg-primary/20 text-primary font-medium"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </Card>
      </div>

      {/* Main Area */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Dev Wiki
            </h1>
            {!loading && (
              <Badge variant="secondary" className="text-xs">
                {pages.length} {pages.length === 1 ? "article" : "articles"}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPages}
              disabled={loading}
            >
              <RefreshCw
                className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> New Page
            </Button>
          </div>
        </div>

        {/* Search */}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search articles..."
        />

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 mx-auto animate-spin" />
            <p className="mt-2 text-sm">Loading pages...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-red-400 text-sm">
              Failed to load wiki pages.
            </CardContent>
          </Card>
        )}

        {/* Article List */}
        {!loading && !error && (
          <>
            {pages.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                  <p className="text-slate-400">
                    {debouncedSearch
                      ? `No articles matching "${debouncedSearch}".`
                      : "No pages found. Create one to get started."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pages.map((page) => {
                  const sectionLabel =
                    SECTIONS.find((s) => s.key === page.section)?.label ||
                    page.section;
                  const badgeColor =
                    SECTION_COLORS[page.section || ""] || DEFAULT_BADGE;

                  return (
                    <button
                      key={page.id}
                      onClick={() => openArticle(page)}
                      className="w-full text-left"
                    >
                      <Card className="hover:border-slate-700 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-white text-sm">
                                  {highlightTitle(page.title)}
                                </span>
                                {page.section && sectionLabel && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium border ${badgeColor}`}
                                  >
                                    {sectionLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                <span className="font-mono">
                                  /{page.slug}
                                </span>
                                <span>&middot;</span>
                                <span>
                                  {page.author || "System"}
                                </span>
                                <span>&middot;</span>
                                <span>
                                  Updated{" "}
                                  {new Date(
                                    page.updatedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          {page.content && (
                            <p className="text-xs text-slate-500 mt-2 truncate max-w-2xl ml-8">
                              {page.content.slice(0, 150)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Editor Drawer */}
      <EditorDrawer
        open={drawerOpen && viewMode === "list"}
        page={drawerMode === "edit" ? selectedPage : null}
        onClose={closeDrawer}
      />
    </div>
  );
}

/* ---------- Editor Drawer ---------- */

function EditorDrawer({
  page,
  onClose,
  open,
}: {
  page?: WikiPage | null;
  onClose: () => void;
  open?: boolean;
}) {
  const isEdit = !!page;
  const [title, setTitle] = useState(page?.title || "");
  const [slug, setSlug] = useState(page?.slug || "");
  const [section, setSection] = useState(page?.section || SECTIONS[0].key);
  const [content, setContent] = useState(page?.content || "");
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // Reset form when page changes
  useEffect(() => {
    setTitle(page?.title || "");
    setSlug(page?.slug || "");
    setSection(page?.section || SECTIONS[0].key);
    setContent(page?.content || "");
    setEditorTab("write");
    setSlugTouched(!!page);
  }, [page]);

  const autoSlug = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slugTouched) {
      setSlug(autoSlug(v));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body = { title, slug, section, content };
      const url = isEdit ? `/api/dev/wiki/${page!.id}` : "/api/dev/wiki";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onClose();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  // When used standalone (read view overlay)
  if (open === undefined) {
    return (
      <DetailDrawer
        open={true}
        onClose={onClose}
        title={isEdit ? "Edit Page" : "New Page"}
        subtitle={isEdit ? page?.slug : undefined}
        width="max-w-2xl"
      >
        <EditorForm
          title={title}
          slug={slug}
          section={section}
          content={content}
          editorTab={editorTab}
          saving={saving}
          isEdit={isEdit}

          onTitleChange={handleTitleChange}
          onSlugChange={(v) => {
            setSlug(v);
            setSlugTouched(true);
          }}
          onSectionChange={setSection}
          onContentChange={setContent}
          onEditorTabChange={setEditorTab}
          onSave={handleSave}
          onClose={onClose}
        />
      </DetailDrawer>
    );
  }

  return (
    <DetailDrawer
      open={!!open}
      onClose={onClose}
      title={isEdit ? "Edit Page" : "New Page"}
      subtitle={isEdit ? page?.slug : undefined}
      width="max-w-2xl"
    >
      <EditorForm
        title={title}
        slug={slug}
        section={section}
        content={content}
        editorTab={editorTab}
        saving={saving}
        isEdit={isEdit}
        onTitleChange={handleTitleChange}
        onSlugChange={(v) => {
          setSlug(v);
          setSlugTouched(true);
        }}
        onSectionChange={setSection}
        onContentChange={setContent}
        onEditorTabChange={setEditorTab}
        onSave={handleSave}
        onClose={onClose}
      />
    </DetailDrawer>
  );
}

/* ---------- Editor Form ---------- */

function EditorForm({
  title,
  slug,
  section,
  content,
  editorTab,
  saving,
  isEdit,
  onTitleChange,
  onSlugChange,
  onSectionChange,
  onContentChange,
  onEditorTabChange,
  onSave,
  onClose,
}: {
  title: string;
  slug: string;
  section: string;
  content: string;
  editorTab: "write" | "preview";
  saving: boolean;
  isEdit: boolean;
  onTitleChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onSectionChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onEditorTabChange: (v: "write" | "preview") => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-6 space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Title *
        </label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Page title"
        />
      </div>

      {/* Slug + Section */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Slug
          </label>
          <Input
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="page-slug"
            className="font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Section
          </label>
          <select
            value={section}
            onChange={(e) => onSectionChange(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content with Write/Preview tabs */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Content (Markdown)
        </label>

        <div className="flex border-b border-slate-700 mb-2">
          <button
            onClick={() => onEditorTabChange("write")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              editorTab === "write"
                ? "border-primary text-primary"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Pencil className="w-3 h-3" /> Write
          </button>
          <button
            onClick={() => onEditorTabChange("preview")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              editorTab === "preview"
                ? "border-primary text-primary"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
        </div>

        {editorTab === "write" ? (
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Write page content in Markdown..."
            className="w-full min-h-[400px] px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
        ) : (
          <div className="border border-slate-700 rounded-lg p-4 min-h-[400px] bg-slate-900/30">
            {content ? (
              <div className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                {content}
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic">
                Nothing to preview
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={!title.trim() || saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : isEdit ? (
            "Save Changes"
          ) : (
            "Create Page"
          )}
        </Button>
      </div>
    </div>
  );
}
