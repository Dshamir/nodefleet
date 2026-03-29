"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  RotateCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface Credential {
  id: string;
  name: string;
  envKey: string | null;
  type: string;
  service: string | null;
  description: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const TYPES = ["api_key", "token", "password", "certificate"];

const TYPE_COLORS: Record<string, string> = {
  api_key: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  token: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  password: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  certificate: "bg-green-500/20 text-green-400 border-green-500/30",
};

function getExpiryStatus(
  expiresAt: string | null
): "valid" | "expiring" | "expired" | "none" {
  if (!expiresAt) return "none";
  const d = new Date(expiresAt).getTime();
  const now = Date.now();
  if (d < now) return "expired";
  if (d - now < 7 * 86400000) return "expiring";
  return "valid";
}

function formatDate(d: string | null): string {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString();
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedId, setRevealedId] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newType, setNewType] = useState("api_key");
  const [newService, setNewService] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCredentials = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/security/credentials");
      if (!res.ok) return;
      const data = await res.json();
      setCredentials(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  async function handleCreate() {
    if (!newName.trim() || !newValue.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/security/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          envKey: newEnvKey || undefined,
          type: newType,
          service: newService || undefined,
          description: newDescription || undefined,
          value: newValue,
          expiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : undefined,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setNewName("");
        setNewEnvKey("");
        setNewType("api_key");
        setNewService("");
        setNewDescription("");
        setNewValue("");
        setNewExpiresAt("");
        fetchCredentials();
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
            Credential Vault
          </h1>
          <p className="text-slate-400">
            Securely store and manage API keys, tokens, and certificates
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-4 h-4" /> Add Credential
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-white">
              {credentials.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {credentials.filter((c) => c.isActive).length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-amber-400">
              {
                credentials.filter(
                  (c) => getExpiryStatus(c.expiresAt) === "expiring"
                ).length
              }
            </p>
            <p className="text-xs text-slate-400 mt-1">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-red-400">
              {
                credentials.filter(
                  (c) => getExpiryStatus(c.expiresAt) === "expired"
                ).length
              }
            </p>
            <p className="text-xs text-slate-400 mt-1">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Credential Cards */}
      {credentials.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-16 text-center">
            <KeyRound className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500">No credentials stored</p>
            <p className="text-xs text-slate-600 mt-1">
              Add API keys, tokens, or certificates to the vault
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {credentials.map((cred) => {
            const expiry = getExpiryStatus(cred.expiresAt);
            return (
              <Card
                key={cred.id}
                className={`bg-slate-900/50 border-slate-800 ${
                  !cred.isActive ? "opacity-50" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="w-4 h-4 text-primary flex-shrink-0" />
                      <CardTitle className="text-base truncate">
                        {cred.name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        onClick={() =>
                          setRevealedId(
                            revealedId === cred.id ? null : cred.id
                          )
                        }
                      >
                        {revealedId === cred.id ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        title="Rotate credential"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {cred.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {cred.description}
                    </p>
                  )}

                  {/* Value preview */}
                  <div className="px-2.5 py-1.5 bg-slate-800/50 rounded border border-slate-700 font-mono text-xs text-slate-400 truncate">
                    {revealedId === cred.id
                      ? "****** (encrypted)"
                      : "********************"}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${
                        TYPE_COLORS[cred.type] ||
                        "bg-slate-500/20 text-slate-400 border-slate-500/30"
                      }`}
                    >
                      {cred.type.replace(/_/g, " ")}
                    </span>
                    {cred.service && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-slate-800"
                      >
                        {cred.service}
                      </Badge>
                    )}
                    {cred.envKey && (
                      <code className="text-xs text-cyan-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
                        {cred.envKey}
                      </code>
                    )}
                  </div>

                  {/* Expiry */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-500">
                        Expires: {formatDate(cred.expiresAt)}
                      </span>
                    </div>
                    {expiry === "expired" && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertTriangle className="w-3 h-3" /> Expired
                      </span>
                    )}
                    {expiry === "expiring" && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="w-3 h-3" /> Expiring soon
                      </span>
                    )}
                    {expiry === "valid" && (
                      <span className="flex items-center gap-1 text-green-400">
                        <ShieldCheck className="w-3 h-3" /> Valid
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Credential Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Credential</DialogTitle>
            <DialogDescription>
              Store a new credential securely in the vault.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Name
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Stripe Live Key"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${
                      newType === t
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {t.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Service
                </label>
                <Input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="e.g. Stripe, AWS"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Env Key
                </label>
                <Input
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  placeholder="STRIPE_SECRET_KEY"
                  className="bg-slate-800 border-slate-700 font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Value
              </label>
              <Input
                type="password"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Paste the secret value"
                className="bg-slate-800 border-slate-700 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional notes"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Expires At
              </label>
              <Input
                type="date"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 gap-2"
                onClick={handleCreate}
                disabled={creating || !newName.trim() || !newValue.trim()}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                <KeyRound className="w-4 h-4" /> Store Credential
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
