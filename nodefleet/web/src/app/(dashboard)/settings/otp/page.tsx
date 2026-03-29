"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Save,
  Hash,
  Timer,
  ShieldCheck,
  Ban,
} from "lucide-react";

interface OtpSettings {
  enabled: boolean;
  codeLength: number;
  expirySeconds: number;
  format: "numeric" | "alphanumeric";
  maxAttempts: number;
  cooldownSeconds: number;
  maxSendsPerHour: number;
}

const DEFAULTS: OtpSettings = {
  enabled: false,
  codeLength: 6,
  expirySeconds: 300,
  format: "numeric",
  maxAttempts: 5,
  cooldownSeconds: 60,
  maxSendsPerHour: 10,
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

export default function OtpSettingsPage() {
  const [settings, setSettings] = useState<OtpSettings>(DEFAULTS);
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
      if (json.data) {
        const d = json.data;
        setSettings({
          enabled: d.otpEnabled?.value ?? d.otpEnabled ?? DEFAULTS.enabled,
          codeLength:
            d.otpCodeLength?.value ?? d.otpCodeLength ?? DEFAULTS.codeLength,
          expirySeconds:
            d.otpExpirySeconds?.value ??
            d.otpExpirySeconds ??
            DEFAULTS.expirySeconds,
          format: d.otpFormat?.value ?? d.otpFormat ?? DEFAULTS.format,
          maxAttempts:
            d.otpMaxAttempts?.value ??
            d.otpMaxAttempts ??
            DEFAULTS.maxAttempts,
          cooldownSeconds:
            d.otpCooldownSeconds?.value ??
            d.otpCooldownSeconds ??
            DEFAULTS.cooldownSeconds,
          maxSendsPerHour:
            d.otpMaxSendsPerHour?.value ??
            d.otpMaxSendsPerHour ??
            DEFAULTS.maxSendsPerHour,
        });
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

  function update<K extends keyof OtpSettings>(key: K, value: OtpSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/auth-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            otpEnabled: settings.enabled,
            otpCodeLength: settings.codeLength,
            otpExpirySeconds: settings.expirySeconds,
            otpFormat: settings.format,
            otpMaxAttempts: settings.maxAttempts,
            otpCooldownSeconds: settings.cooldownSeconds,
            otpMaxSendsPerHour: settings.maxSendsPerHour,
          },
        }),
      });
      if (res.ok) {
        setDirty(false);
        setMsg({ text: "OTP settings saved.", ok: true });
      } else {
        setMsg({ text: "Failed to save.", ok: false });
      }
    } catch {
      setMsg({ text: "Failed to save.", ok: false });
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
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">OTP Settings</h1>
          <p className="text-slate-400">
            Configure one-time password generation and rate limits
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
            Save
          </Button>
        )}
      </div>

      {msg && (
        <p
          className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}
        >
          {msg.text}
        </p>
      )}

      {/* Enable/Disable */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-white">
                  Enable OTP Verification
                </p>
                <p className="text-xs text-slate-500">
                  Send one-time codes for login and sensitive actions
                </p>
              </div>
            </div>
            <Toggle
              checked={settings.enabled}
              onChange={(v) => update("enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Code Configuration */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Hash className="w-5 h-5 text-cyan-400" /> Code Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Code Length
              </label>
              <Input
                type="number"
                value={settings.codeLength}
                onChange={(e) =>
                  update("codeLength", parseInt(e.target.value) || 6)
                }
                min={4}
                max={10}
                className="bg-slate-800 border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                Number of digits (4-10)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Format
              </label>
              <div className="flex gap-2">
                {(["numeric", "alphanumeric"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => update("format", fmt)}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                      settings.format === fmt
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expiry & Timing */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="w-5 h-5 text-amber-400" /> Expiry & Timing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Code Expiry (seconds)
              </label>
              <Input
                type="number"
                value={settings.expirySeconds}
                onChange={(e) =>
                  update("expirySeconds", parseInt(e.target.value) || 60)
                }
                min={30}
                max={3600}
                className="bg-slate-800 border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                {Math.floor(settings.expirySeconds / 60)}m{" "}
                {settings.expirySeconds % 60}s
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Cooldown Between Resends (seconds)
              </label>
              <Input
                type="number"
                value={settings.cooldownSeconds}
                onChange={(e) =>
                  update("cooldownSeconds", parseInt(e.target.value) || 30)
                }
                min={10}
                max={600}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-400" /> Rate Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Verification Attempts
              </label>
              <Input
                type="number"
                value={settings.maxAttempts}
                onChange={(e) =>
                  update("maxAttempts", parseInt(e.target.value) || 3)
                }
                min={1}
                max={20}
                className="bg-slate-800 border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                Lock out after this many wrong codes
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Sends Per Hour
              </label>
              <Input
                type="number"
                value={settings.maxSendsPerHour}
                onChange={(e) =>
                  update("maxSendsPerHour", parseInt(e.target.value) || 5)
                }
                min={1}
                max={100}
                className="bg-slate-800 border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                Prevent OTP flooding attacks
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
