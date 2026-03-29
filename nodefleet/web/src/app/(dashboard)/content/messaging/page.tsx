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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Settings2,
  FileText,
  Clock,
  Server,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string | null;
  htmlBody: string | null;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState("smtp");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // SMTP form state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");

  // Template form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/content/messaging?${params}`);
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
    if (activeTab === "templates") {
      fetchTemplates();
    }
  }, [activeTab, fetchTemplates]);

  function openCreate() {
    setFormName("");
    setFormSlug("");
    setFormSubject("");
    setFormBody("");
    setDialogOpen(true);
  }

  async function handleSaveTemplate() {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/content/messaging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          slug: formSlug,
          subject: formSubject,
          htmlBody: formBody,
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
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Messaging</h1>
        <p className="text-slate-400">
          Configure email delivery and manage templates
        </p>
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="smtp" className="gap-2">
            <Server className="w-4 h-4" />
            SMTP Config
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="w-4 h-4" />
            Email Logs
          </TabsTrigger>
        </TabsList>

        {/* SMTP Config Tab */}
        <TabsContent value="smtp">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Settings2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-white">
                  SMTP Configuration
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    SMTP Host
                  </label>
                  <Input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Port
                  </label>
                  <Input
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Username
                  </label>
                  <Input
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="user@example.com"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    From Address
                  </label>
                  <Input
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    placeholder="noreply@example.com"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button className="gap-2">
                  <Settings2 className="w-4 h-4" />
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="templates">
          <div className="space-y-4">
            {/* Search + Actions */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
              </div>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                New Template
              </Button>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-slate-400">
                  Loading templates...
                </span>
              </div>
            )}

            {/* Empty */}
            {!loading && filteredTemplates.length === 0 && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="pt-12 pb-12 text-center">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400 text-lg">No templates found</p>
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
                          Subject
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
                          className="hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span className="text-white font-medium">
                                {tmpl.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-sm font-mono">
                            {tmpl.slug}
                          </td>
                          <td className="px-6 py-4 text-slate-300 text-sm truncate max-w-[200px]">
                            {tmpl.subject || "--"}
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
          </div>
        </TabsContent>

        {/* Email Logs Tab */}
        <TabsContent value="logs">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-12 pb-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400 text-lg">Email Logs</p>
              <p className="text-slate-500 text-sm mt-1">
                Email delivery logs will appear here once SMTP is configured and
                emails are sent.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
            <DialogDescription>
              Define a reusable email template with variable placeholders
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
                    setFormSlug(slugify(e.target.value));
                  }}
                  placeholder="Welcome Email"
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
                  placeholder="welcome-email"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Subject
              </label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Welcome to {{company}}"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                HTML Body
              </label>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="<h1>Welcome, {{name}}!</h1>..."
                rows={8}
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
                onClick={handleSaveTemplate}
                disabled={saving || !formName || !formSlug}
                className="gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
