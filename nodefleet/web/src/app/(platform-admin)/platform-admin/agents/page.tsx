"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DetailDrawer } from "@/components/ui/detail-drawer";
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
  Bot,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Power,
  PowerOff,
  Cpu,
  Settings,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agent {
  id: string;
  name: string;
  description: string | null;
  category: string;
  providerId: string | null;
  providerName: string | null;
  providerVendor: string | null;
  systemPrompt: string | null;
  isActive: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface Provider {
  id: string;
  name: string;
  vendor: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORIES = ["system", "support", "chat", "workflow", "custom"];

const CATEGORY_COLORS: Record<string, string> = {
  system: "bg-red-500/20 text-red-400 border-red-500/30",
  support: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  chat: "bg-green-500/20 text-green-400 border-green-500/30",
  workflow: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  custom: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("custom");
  const [formProviderId, setFormProviderId] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await fetch(`/api/ai/agents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch agents");
      const json = await res.json();
      setAgents(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/providers?limit=100");
      if (!res.ok) return;
      const json = await res.json();
      setProviders(
        (json.data || []).map((p: Provider) => ({
          id: p.id,
          name: p.name,
          vendor: p.vendor,
        }))
      );
    } catch {}
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchProviders();
  }, [fetchAgents, fetchProviders]);

  function openCreate() {
    setFormName("");
    setFormDescription("");
    setFormCategory("custom");
    setFormProviderId("");
    setFormSystemPrompt("");
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/ai/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription || undefined,
          category: formCategory,
          providerId: formProviderId || undefined,
          systemPrompt: formSystemPrompt || undefined,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save agent");
      }
      setDialogOpen(false);
      await fetchAgents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = [
    { value: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Custom Agents</h1>
          <p className="text-slate-400">
            Create and manage AI agents for different tasks
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          New Agent
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
          <FilterTabs
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
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
          <span className="ml-3 text-slate-400">Loading agents...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && agents.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <Bot className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No agents configured</p>
            <p className="text-slate-500 text-sm mt-1">
              Create your first custom AI agent
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              New Agent
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className="bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => setSelectedAgent(agent)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {agent.name}
                      </h3>
                      {agent.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {agent.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {agent.isActive ? (
                    <Power className="w-4 h-4 text-green-400" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-red-400" />
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge
                    className={`text-xs border capitalize ${
                      CATEGORY_COLORS[agent.category] || CATEGORY_COLORS.custom
                    }`}
                  >
                    {agent.category}
                  </Badge>
                  <StatusBadge
                    status={agent.isActive ? "active" : "inactive"}
                  />
                </div>

                {agent.providerName && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Cpu className="w-3.5 h-3.5" />
                    <span className="text-xs">
                      {agent.providerName}{" "}
                      {agent.providerVendor && (
                        <span className="text-slate-500">
                          ({agent.providerVendor})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        title={selectedAgent?.name || "Agent Details"}
        subtitle={selectedAgent?.category}
        width="max-w-2xl"
      >
        {selectedAgent && (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-1">
                  Description
                </h3>
                <p className="text-white text-sm">
                  {selectedAgent.description || "No description"}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">
                    Category
                  </h3>
                  <Badge
                    className={`text-xs border capitalize ${
                      CATEGORY_COLORS[selectedAgent.category] ||
                      CATEGORY_COLORS.custom
                    }`}
                  >
                    {selectedAgent.category}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">
                    Status
                  </h3>
                  <StatusBadge
                    status={selectedAgent.isActive ? "active" : "inactive"}
                  />
                </div>
              </div>

              {selectedAgent.providerName && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">
                    Provider
                  </h3>
                  <p className="text-white text-sm">
                    {selectedAgent.providerName}{" "}
                    {selectedAgent.providerVendor && (
                      <span className="text-slate-400">
                        ({selectedAgent.providerVendor})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {selectedAgent.systemPrompt && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">
                    System Prompt
                  </h3>
                  <pre className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap font-mono overflow-auto max-h-80">
                    {selectedAgent.systemPrompt}
                  </pre>
                </div>
              )}

              {selectedAgent.config && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">
                    Configuration
                  </h3>
                  <pre className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap font-mono overflow-auto max-h-60">
                    {JSON.stringify(selectedAgent.config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Create Agent Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Agent</DialogTitle>
            <DialogDescription>
              Configure a new AI agent with a specific role and behavior
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Agent Name
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Customer Support Agent"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Description
              </label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Handles customer support inquiries"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Category
                </label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                  Provider
                </label>
                <Select value={formProviderId} onValueChange={setFormProviderId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.vendor})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                System Prompt
              </label>
              <textarea
                value={formSystemPrompt}
                onChange={(e) => setFormSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant that..."
                rows={6}
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
                disabled={saving || !formName}
                className="gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Agent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
