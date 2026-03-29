"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterTabs } from "@/components/ui/filter-tabs";
import {
  Loader2,
  Clock,
  Lock,
  Smartphone,
  Save,
} from "lucide-react";

type AuthTab = "sessions" | "passwords" | "mfa";

interface AuthSettingsData {
  // Sessions
  sessionTimeout: number;
  maxConcurrentSessions: number;
  rememberMeDuration: number;
  idleTimeout: number;
  // Passwords
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  passwordExpireDays: number;
  passwordHistoryCount: number;
  // MFA
  mfaEnabled: boolean;
  mfaRequired: boolean;
  otpCodeLength: number;
  otpExpirySeconds: number;
  mfaMethods: string[];
}

const DEFAULTS: AuthSettingsData = {
  sessionTimeout: 1440,
  maxConcurrentSessions: 5,
  rememberMeDuration: 30,
  idleTimeout: 30,
  minPasswordLength: 8,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  passwordExpireDays: 90,
  passwordHistoryCount: 5,
  mfaEnabled: false,
  mfaRequired: false,
  otpCodeLength: 6,
  otpExpirySeconds: 300,
  mfaMethods: ["totp"],
};

const TAB_OPTIONS = [
  { value: "sessions", label: "Sessions" },
  { value: "passwords", label: "Passwords" },
  { value: "mfa", label: "MFA / OTP" },
];

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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AuthSettingsPage() {
  const [tab, setTab] = useState<AuthTab>("sessions");
  const [settings, setSettings] = useState<AuthSettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/auth-settings");
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && Object.keys(json.data).length > 0) {
        const merged = { ...DEFAULTS };
        for (const [key, val] of Object.entries(json.data)) {
          if (key in merged && val !== null && val !== undefined) {
            (merged as any)[key] = (val as any)?.value ?? val;
          }
        }
        setSettings(merged);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function update<K extends keyof AuthSettingsData>(
    key: K,
    value: AuthSettingsData[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(settings)) {
        payload[key] = value;
      }
      const res = await fetch("/api/auth/auth-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (res.ok) {
        setDirty(false);
        setMsg({ text: "Settings saved.", ok: true });
      } else {
        setMsg({ text: "Failed to save settings.", ok: false });
      }
    } catch {
      setMsg({ text: "Failed to save settings.", ok: false });
    } finally {
      setSaving(false);
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
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Auth Settings
          </h1>
          <p className="text-slate-400">
            Configure authentication, session, and security policies
          </p>
        </div>
        {dirty && (
          <Button
            className="bg-primary hover:bg-primary/90 gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      <FilterTabs
        options={TAB_OPTIONS}
        value={tab}
        onChange={(v) => setTab(v as AuthTab)}
      />

      {msg && (
        <p
          className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}
        >
          {msg.text}
        </p>
      )}

      {/* Sessions Tab */}
      {tab === "sessions" && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Session Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Session Timeout (minutes)
                </label>
                <Input
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) =>
                    update("sessionTimeout", parseInt(e.target.value) || 0)
                  }
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  How long before an active session expires
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Max Concurrent Sessions
                </label>
                <Input
                  type="number"
                  value={settings.maxConcurrentSessions}
                  onChange={(e) =>
                    update(
                      "maxConcurrentSessions",
                      parseInt(e.target.value) || 1
                    )
                  }
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Max simultaneous sessions per user
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Remember Me Duration (days)
                </label>
                <Input
                  type="number"
                  value={settings.rememberMeDuration}
                  onChange={(e) =>
                    update("rememberMeDuration", parseInt(e.target.value) || 0)
                  }
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Idle Timeout (minutes)
                </label>
                <Input
                  type="number"
                  value={settings.idleTimeout}
                  onChange={(e) =>
                    update("idleTimeout", parseInt(e.target.value) || 0)
                  }
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Auto-logout after inactivity
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passwords Tab */}
      {tab === "passwords" && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Password Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Minimum Length
                </label>
                <Input
                  type="number"
                  value={settings.minPasswordLength}
                  onChange={(e) =>
                    update("minPasswordLength", parseInt(e.target.value) || 6)
                  }
                  min={6}
                  max={128}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password Expiry (days)
                </label>
                <Input
                  type="number"
                  value={settings.passwordExpireDays}
                  onChange={(e) =>
                    update("passwordExpireDays", parseInt(e.target.value) || 0)
                  }
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  0 = never expires
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password History
                </label>
                <Input
                  type="number"
                  value={settings.passwordHistoryCount}
                  onChange={(e) =>
                    update(
                      "passwordHistoryCount",
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Number of previous passwords to remember
                </p>
              </div>
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Require Uppercase
                  </p>
                  <p className="text-xs text-slate-500">
                    At least one uppercase letter
                  </p>
                </div>
                <Toggle
                  checked={settings.requireUppercase}
                  onChange={(v) => update("requireUppercase", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Require Numbers
                  </p>
                  <p className="text-xs text-slate-500">
                    At least one numeric digit
                  </p>
                </div>
                <Toggle
                  checked={settings.requireNumbers}
                  onChange={(v) => update("requireNumbers", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Require Special Characters
                  </p>
                  <p className="text-xs text-slate-500">
                    At least one symbol (!@#$...)
                  </p>
                </div>
                <Toggle
                  checked={settings.requireSpecialChars}
                  onChange={(v) => update("requireSpecialChars", v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MFA Tab */}
      {tab === "mfa" && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" /> Multi-Factor
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Enable MFA
                  </p>
                  <p className="text-xs text-slate-500">
                    Allow users to set up two-factor authentication
                  </p>
                </div>
                <Toggle
                  checked={settings.mfaEnabled}
                  onChange={(v) => update("mfaEnabled", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Require MFA for All Users
                  </p>
                  <p className="text-xs text-slate-500">
                    Force MFA enrollment at next login
                  </p>
                </div>
                <Toggle
                  checked={settings.mfaRequired}
                  onChange={(v) => update("mfaRequired", v)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  OTP Code Length
                </label>
                <Input
                  type="number"
                  value={settings.otpCodeLength}
                  onChange={(e) =>
                    update("otpCodeLength", parseInt(e.target.value) || 6)
                  }
                  min={4}
                  max={10}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  OTP Expiry (seconds)
                </label>
                <Input
                  type="number"
                  value={settings.otpExpirySeconds}
                  onChange={(e) =>
                    update("otpExpirySeconds", parseInt(e.target.value) || 60)
                  }
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Time before OTP code expires
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Allowed MFA Methods
              </label>
              <div className="flex gap-3">
                {["totp", "sms", "email"].map((method) => (
                  <button
                    key={method}
                    onClick={() => {
                      const current = settings.mfaMethods;
                      if (current.includes(method)) {
                        update(
                          "mfaMethods",
                          current.filter((m) => m !== method)
                        );
                      } else {
                        update("mfaMethods", [...current, method]);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      settings.mfaMethods.includes(method)
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {method.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
