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
  Brain,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Zap,
  Key,
  Globe,
  Power,
  PowerOff,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiProvider {
  id: string;
  name: string;
  vendor: string;
  baseUrl: string | null;
  model: string | null;
  hasApiKey: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VENDORS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "custom", label: "Custom" },
];

const VENDOR_COLORS: Record<string, string> = {
  openai: "bg-green-500/20 text-green-400 border-green-500/30",
  anthropic: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  google: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  azure: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  custom: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const VENDOR_ICONS: Record<string, string> = {
  openai: "OAI",
  anthropic: "ANT",
  google: "GCP",
  azure: "AZR",
  custom: "API",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formVendor, setFormVendor] = useState("openai");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formApiKey, setFormApiKey] = useState("");

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/ai/providers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      const json = await res.json();
      setProviders(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  function openCreate() {
    setFormName("");
    setFormVendor("openai");
    setFormBaseUrl("");
    setFormModel("");
    setFormApiKey("");
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          vendor: formVendor,
          baseUrl: formBaseUrl || undefined,
          model: formModel || undefined,
          apiKeyEncrypted: formApiKey || undefined,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save provider");
      }
      setDialogOpen(false);
      await fetchProviders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filteredProviders = providers.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.vendor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Providers</h1>
          <p className="text-slate-400">
            Manage AI model providers and API connections
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Provider
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search providers..."
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
          <span className="ml-3 text-slate-400">Loading providers...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && filteredProviders.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No AI providers configured</p>
            <p className="text-slate-500 text-sm mt-1">
              Add your first provider to start using AI features
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Add Provider
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Provider Cards */}
      {!loading && filteredProviders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => (
            <Card
              key={provider.id}
              className="bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-all"
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                        VENDOR_COLORS[provider.vendor] || VENDOR_COLORS.custom
                      }`}
                    >
                      {VENDOR_ICONS[provider.vendor] || "API"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {provider.name}
                      </h3>
                      <Badge
                        className={`text-xs border capitalize mt-1 ${
                          VENDOR_COLORS[provider.vendor] || VENDOR_COLORS.custom
                        }`}
                      >
                        {provider.vendor}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {provider.isActive ? (
                      <Power className="w-4 h-4 text-green-400" />
                    ) : (
                      <PowerOff className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>

                {provider.model && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="font-mono text-xs">{provider.model}</span>
                  </div>
                )}

                {provider.baseUrl && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                    <Globe className="w-3.5 h-3.5" />
                    <span className="text-xs truncate">{provider.baseUrl}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm mb-3">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs text-slate-500">
                    API Key: {provider.hasApiKey ? "Configured" : "Not set"}
                  </span>
                  {provider.hasApiKey && (
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <StatusBadge
                    status={provider.isActive ? "active" : "inactive"}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Provider Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add AI Provider</DialogTitle>
            <DialogDescription>
              Configure a new AI model provider connection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Provider Name
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My OpenAI Provider"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Vendor
              </label>
              <Select value={formVendor} onValueChange={setFormVendor}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDORS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Base URL
              </label>
              <Input
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Model
              </label>
              <Input
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                placeholder="gpt-4o"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                API Key
              </label>
              <Input
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
                type="password"
                className="bg-slate-800 border-slate-700"
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
                disabled={saving || !formName || !formVendor}
                className="gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Provider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
