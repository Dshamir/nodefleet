"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  FileCheck,
  Plus,
  ShieldCheck,
} from "lucide-react";

interface ContentPolicy {
  id: string;
  name: string;
  description: string | null;
  policyType: string;
  action: string;
  rules: string[] | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const POLICY_TYPES = [
  "file-upload",
  "text-content",
  "model-input",
  "api-payload",
  "webhook",
];
const ACTIONS = ["flag", "reject", "quarantine", "log"];

const ACTION_COLORS: Record<string, string> = {
  flag: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  reject: "bg-red-500/20 text-red-400 border-red-500/30",
  quarantine: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  log: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-green-500" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ContentPolicyPage() {
  const [policies, setPolicies] = useState<ContentPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState(POLICY_TYPES[0]);
  const [newAction, setNewAction] = useState<string>("flag");
  const [creating, setCreating] = useState(false);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/security/content-policies");
      if (!res.ok) return;
      const data = await res.json();
      setPolicies(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await fetch("/api/security/content-policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      setPolicies((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled } : p))
      );
    } catch {
      /* ignore */
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/security/content-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          policyType: newType,
          action: newAction,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setNewName("");
        setNewDescription("");
        setNewType(POLICY_TYPES[0]);
        setNewAction("flag");
        fetchPolicies();
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Content Policies
          </h1>
          <p className="text-slate-400">
            Define rules for content moderation and validation
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-4 h-4" /> Create Policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500">No content policies configured</p>
            <p className="text-xs text-slate-600 mt-1">
              Create a policy to start moderating content
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <Card
              key={policy.id}
              className={`bg-slate-900/50 border-slate-800 transition-opacity ${
                !policy.enabled ? "opacity-60" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {policy.name}
                    </CardTitle>
                    {policy.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {policy.description}
                      </p>
                    )}
                  </div>
                  <Toggle
                    checked={policy.enabled}
                    onChange={(v) => handleToggle(policy.id, v)}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-slate-800 capitalize"
                  >
                    <FileCheck className="w-3 h-3 mr-1" />
                    {policy.policyType}
                  </Badge>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${
                      ACTION_COLORS[policy.action] ||
                      "bg-slate-500/20 text-slate-400 border-slate-500/30"
                    }`}
                  >
                    {policy.action}
                  </span>
                  <StatusBadge
                    status={policy.enabled ? "active" : "disabled"}
                  />
                </div>
                {policy.rules &&
                  Array.isArray(policy.rules) &&
                  policy.rules.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {policy.rules.slice(0, 3).map((rule, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-slate-800/50 rounded text-slate-400 border border-slate-700"
                        >
                          {rule}
                        </span>
                      ))}
                      {policy.rules.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{policy.rules.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                <p className="text-xs text-slate-600 mt-3">
                  Updated{" "}
                  {new Date(policy.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Policy Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle>Create Content Policy</DialogTitle>
            <DialogDescription>
              Define a new content moderation or validation rule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Policy Name
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Block Executable Uploads"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Policy Type
              </label>
              <div className="flex flex-wrap gap-2">
                {POLICY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${
                      newType === t
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Action
              </label>
              <div className="flex gap-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setNewAction(a)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                      newAction === a
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 gap-2"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Policy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
