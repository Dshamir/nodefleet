"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, User, Building2, Lock, KeyRound, Plus, Copy, Check, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface SessionUser {
  name: string;
  email: string;
  orgId: string;
  role: string;
}

interface OrgInfo {
  name: string;
  slug: string;
  plan: string;
  deviceLimit: number;
  orgIdentifier: string;
  owner: { name: string; email: string };
  stats: { devices: number; media: number; members: number };
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const d = new Date(date).getTime();
  if (isNaN(d)) return "Never";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function SettingsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Organization
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMsg, setOrgMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Password
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyGenerating, setKeyGenerating] = useState(false);

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  // Fetch session
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = await res.json();
        const u: SessionUser = {
          name: data.user?.name || "",
          email: data.user?.email || "",
          orgId: data.user?.orgId || "",
          role: data.user?.role || "member",
        };
        setUser(u);
        setProfileName(u.name);
        setProfileEmail(u.email);
      } catch {}
      finally { setLoading(false); }
    }
    async function fetchOrg() {
      try {
        const res = await fetch("/api/org");
        if (!res.ok) return;
        const data = await res.json();
        setOrg(data);
        setOrgName(data.name);
      } catch {}
    }
    fetchSession();
    fetchOrg();
  }, []);

  // Fetch API keys
  const fetchKeys = useCallback(async () => {
    try {
      setKeysLoading(true);
      const res = await fetch("/api/keys");
      if (!res.ok) return;
      const data = await res.json();
      setApiKeys(data.data || []);
    } catch {}
    finally { setKeysLoading(false); }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  // Profile update
  async function handleUpdateProfile() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      });
      if (res.ok) {
        setProfileMsg({ text: "Profile updated.", ok: true });
        setUser((p) => p ? { ...p, name: profileName, email: profileEmail } : p);
      } else {
        const d = await res.json().catch(() => ({}));
        setProfileMsg({ text: d.error || "Failed to update.", ok: false });
      }
    } catch { setProfileMsg({ text: "Failed to update.", ok: false }); }
    finally { setProfileSaving(false); }
  }

  // Password change
  async function handleChangePw() {
    setPwMsg(null);
    if (newPw.length < 8) { setPwMsg({ text: "Min 8 characters.", ok: false }); return; }
    if (newPw !== confirmPw) { setPwMsg({ text: "Passwords don't match.", ok: false }); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      if (res.ok) {
        setPwMsg({ text: "Password changed.", ok: true });
        setOldPw(""); setNewPw(""); setConfirmPw(""); setShowPwForm(false);
      } else {
        const d = await res.json().catch(() => ({}));
        setPwMsg({ text: d.error || "Failed.", ok: false });
      }
    } catch { setPwMsg({ text: "Failed.", ok: false }); }
    finally { setPwSaving(false); }
  }

  // Generate API key
  async function handleGenerateKey() {
    setKeyGenerating(true);
    setGeneratedKey(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "API Key" }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.key);
        setNewKeyName("");
        fetchKeys();
      }
    } catch {}
    finally { setKeyGenerating(false); }
  }

  // Revoke key
  async function handleRevokeKey(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    fetchKeys();
  }

  // Copy key
  function handleCopyKey() {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  }

  // Delete account
  async function handleDeleteAccount() {
    setDeleteErr("");
    if (!deletePw) { setDeleteErr("Password required."); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePw }),
      });
      if (res.ok) {
        window.location.href = "/login";
      } else {
        const d = await res.json().catch(() => ({}));
        setDeleteErr(d.error || "Failed to delete account.");
      }
    } catch { setDeleteErr("Failed to delete account."); }
    finally { setDeleting(false); }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account, security, and API access</p>
      </div>

      {/* Profile */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)}
              className="bg-slate-800 border-slate-700" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <Input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)}
              className="bg-slate-800 border-slate-700" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
            <Badge variant="secondary" className="capitalize">{user?.role || "member"}</Badge>
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.ok ? "text-green-400" : "text-red-400"}`}>{profileMsg.text}</p>
          )}
          <Button className="bg-primary hover:bg-primary-dark gap-2" onClick={handleUpdateProfile} disabled={profileSaving}>
            {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />} Update Profile
          </Button>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {org ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Organization Name</label>
                  {user?.role === "owner" || user?.role === "admin" ? (
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)}
                      className="bg-slate-800 border-slate-700" />
                  ) : (
                    <Input value={org.name} readOnly className="bg-slate-800 border-slate-700 text-slate-400" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Organization ID</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-950 rounded border border-slate-700 text-primary font-mono text-sm">
                      {org.orgIdentifier}
                    </code>
                    <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => {
                      navigator.clipboard.writeText(org.orgIdentifier);
                    }}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                  <p className="text-2xl font-bold text-white">{org.stats.devices}</p>
                  <p className="text-xs text-slate-400">Devices</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                  <p className="text-2xl font-bold text-white">{org.stats.media}</p>
                  <p className="text-xs text-slate-400">Media Files</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                  <p className="text-2xl font-bold text-white">{org.stats.members}</p>
                  <p className="text-xs text-slate-400">Members</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                  <p className="text-2xl font-bold text-white capitalize">{org.plan}</p>
                  <p className="text-xs text-slate-400">Plan ({org.deviceLimit} device limit)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span>Slug: <code className="text-slate-300">{org.slug}</code></span>
                <span>Owner: <span className="text-slate-300">{org.owner.name} ({org.owner.email})</span></span>
              </div>
              {orgMsg && <p className={`text-sm ${orgMsg.ok ? "text-green-400" : "text-red-400"}`}>{orgMsg.text}</p>}
              {(user?.role === "owner" || user?.role === "admin") && (
                <Button className="bg-primary hover:bg-primary-dark gap-2" disabled={orgSaving} onClick={async () => {
                  setOrgSaving(true); setOrgMsg(null);
                  try {
                    const res = await fetch("/api/org", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: orgName }) });
                    if (res.ok) { setOrgMsg({ text: "Organization updated.", ok: true }); setOrg(prev => prev ? { ...prev, name: orgName } : prev); }
                    else { const d = await res.json().catch(() => ({})); setOrgMsg({ text: d.error || "Failed.", ok: false }); }
                  } catch { setOrgMsg({ text: "Failed.", ok: false }); }
                  finally { setOrgSaving(false); }
                }}>
                  {orgSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save Organization
                </Button>
              )}
            </>
          ) : (
            <p className="text-slate-500">Loading organization...</p>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPwForm ? (
            <Button variant="outline" onClick={() => setShowPwForm(true)} className="gap-2">
              <Lock className="w-4 h-4" /> Change Password
            </Button>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
                <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)}
                  className="bg-slate-800 border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  className="bg-slate-800 border-slate-700" placeholder="Min 8 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Confirm New Password</label>
                <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  className="bg-slate-800 border-slate-700" />
              </div>
              {pwMsg && <p className={`text-sm ${pwMsg.ok ? "text-green-400" : "text-red-400"}`}>{pwMsg.text}</p>}
              <div className="flex gap-2">
                <Button className="bg-primary hover:bg-primary-dark gap-2" onClick={handleChangePw} disabled={pwSaving}>
                  {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />} Change Password
                </Button>
                <Button variant="ghost" onClick={() => { setShowPwForm(false); setOldPw(""); setNewPw(""); setConfirmPw(""); setPwMsg(null); }}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">
            API keys provide programmatic access to your fleet. Keys are generated using a SHA-256 hash
            of your organization and user identity combined with a random salt. The full key is shown only once.
          </p>

          {/* Generate new key */}
          <div className="flex gap-2">
            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production)" className="bg-slate-800 border-slate-700 flex-1" />
            <Button className="bg-primary hover:bg-primary-dark gap-2" onClick={handleGenerateKey} disabled={keyGenerating}>
              {keyGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate Key
            </Button>
          </div>

          {/* Show generated key (once only) */}
          {generatedKey && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400 font-medium mb-2">Save this key now — it will not be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-950 rounded border border-slate-700 text-white font-mono text-sm break-all">
                  {generatedKey}
                </code>
                <Button size="icon" variant="outline" onClick={handleCopyKey}>
                  {keyCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Keys list */}
          {keysLoading ? (
            <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /> <span className="text-slate-400 text-sm">Loading keys...</span></div>
          ) : apiKeys.length === 0 ? (
            <p className="text-slate-500 text-sm py-2">No API keys. Generate one to get started.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div>
                    <p className="text-white text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{k.keyPrefix}...****</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Created {timeAgo(k.createdAt)}</span>
                    <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-300 h-8 w-8"
                      onClick={() => handleRevokeKey(k.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl">Billing & Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 mb-4">Manage your subscription and payment details.</p>
          <Link href="/settings/billing">
            <Button className="bg-primary hover:bg-primary-dark">Go to Billing</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-error/10 border-error/30">
        <CardHeader>
          <CardTitle className="text-xl text-error flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">
            Permanently delete your account and all associated data including devices, media, and organization (if sole owner). This cannot be undone.
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete Account</Button>
        </CardContent>
      </Card>

      {/* Delete Account Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Account</DialogTitle>
            <DialogDescription>Enter your password to confirm permanent account deletion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)}
              placeholder="Enter your password" className="bg-slate-800 border-slate-700" />
            {deleteErr && <p className="text-sm text-red-400">{deleteErr}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => { setDeleteOpen(false); setDeletePw(""); setDeleteErr(""); }}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-2" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete Forever
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
