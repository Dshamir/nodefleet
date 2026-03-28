"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Mic, MapPin, Radio, Wifi, Zap, Save, Loader2 } from "lucide-react";

interface DeviceSettingsData {
  cameraEnabled: boolean;
  audioEnabled: boolean;
  gpsEnabled: boolean;
  lteEnabled: boolean;
  mqttEnabled: boolean;
  heartbeatInterval: number;
  gpsInterval: number;
  cameraResolution: string;
  powerMode: string;
}

interface Props {
  deviceId: string;
}

function Toggle({ enabled, onChange, label, icon: Icon }: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-emerald-500" : "bg-slate-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function FeatureToggles({ deviceId }: Props) {
  const [settings, setSettings] = useState<DeviceSettingsData>({
    cameraEnabled: true,
    audioEnabled: false,
    gpsEnabled: true,
    lteEnabled: true,
    mqttEnabled: false,
    heartbeatInterval: 30000,
    gpsInterval: 60000,
    cameraResolution: "QVGA",
    powerMode: "active",
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/devices/${deviceId}/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setSettings({
            cameraEnabled: data.cameraEnabled ?? true,
            audioEnabled: data.audioEnabled ?? false,
            gpsEnabled: data.gpsEnabled ?? true,
            lteEnabled: data.lteEnabled ?? true,
            mqttEnabled: data.mqttEnabled ?? false,
            heartbeatInterval: data.heartbeatInterval ?? 30000,
            gpsInterval: data.gpsInterval ?? 60000,
            cameraResolution: data.cameraResolution ?? "QVGA",
            powerMode: data.powerMode ?? "active",
          });
        }
      })
      .catch(console.error);
  }, [deviceId]);

  const update = (key: keyof DeviceSettingsData, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch(`/api/devices/${deviceId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setDirty(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    setSaving(false);
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300">Device Capabilities</CardTitle>
          {dirty && (
            <Button size="sm" onClick={saveSettings} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Save & Push
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <Toggle enabled={settings.cameraEnabled} onChange={(v) => update("cameraEnabled", v)} label="Camera (OV2640)" icon={Camera} />
        <Toggle enabled={settings.audioEnabled} onChange={(v) => update("audioEnabled", v)} label="Audio (INMP441)" icon={Mic} />
        <Toggle enabled={settings.gpsEnabled} onChange={(v) => update("gpsEnabled", v)} label="GPS Tracking" icon={MapPin} />
        <Toggle enabled={settings.lteEnabled} onChange={(v) => update("lteEnabled", v)} label="LTE Cellular" icon={Radio} />
        <Toggle enabled={settings.mqttEnabled} onChange={(v) => update("mqttEnabled", v)} label="MQTT Publishing" icon={Wifi} />

        <div className="border-t border-slate-800 pt-3 mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Heartbeat Interval</span>
            <Select value={String(settings.heartbeatInterval)} onValueChange={(v) => update("heartbeatInterval", parseInt(v))}>
              <SelectTrigger className="w-28 h-8 text-xs bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10000">10s</SelectItem>
                <SelectItem value="30000">30s</SelectItem>
                <SelectItem value="60000">1 min</SelectItem>
                <SelectItem value="300000">5 min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">GPS Interval</span>
            <Select value={String(settings.gpsInterval)} onValueChange={(v) => update("gpsInterval", parseInt(v))}>
              <SelectTrigger className="w-28 h-8 text-xs bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30000">30s</SelectItem>
                <SelectItem value="60000">1 min</SelectItem>
                <SelectItem value="300000">5 min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Power Mode</span>
            <Select value={settings.powerMode} onValueChange={(v) => update("powerMode", v)}>
              <SelectTrigger className="w-28 h-8 text-xs bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="sleep">Sleep</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Camera Resolution</span>
            <Select value={settings.cameraResolution} onValueChange={(v) => update("cameraResolution", v)}>
              <SelectTrigger className="w-28 h-8 text-xs bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QVGA">QVGA (320x240)</SelectItem>
                <SelectItem value="VGA">VGA (640x480)</SelectItem>
                <SelectItem value="SVGA">SVGA (800x600)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
