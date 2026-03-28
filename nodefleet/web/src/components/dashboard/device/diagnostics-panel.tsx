"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, Cpu, HardDrive, Thermometer, Wifi, Radio } from "lucide-react";

interface Props {
  deviceId: string;
  device: {
    status: string;
    firmwareVersion: string | null;
    lastHeartbeatAt: string | null;
    createdAt: string;
  } | null;
  latestTelemetry: {
    batteryLevel: number | null;
    signalStrength: number | null;
    cpuTemp: number | null;
    freeMemory: number | null;
    uptimeSeconds: number | null;
  } | null;
}

function HealthGauge({ label, value, unit, max, warn, critical, icon: Icon }: {
  label: string;
  value: number | null;
  unit: string;
  max: number;
  warn: number;
  critical: number;
  icon: React.ElementType;
}) {
  const v = value ?? 0;
  const pct = Math.min((v / max) * 100, 100);
  const color = v >= critical ? "text-red-400" : v >= warn ? "text-yellow-400" : "text-emerald-400";
  const barColor = v >= critical ? "bg-red-500" : v >= warn ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
        <span className={`text-sm font-mono ${color}`}>
          {value != null ? `${value}${unit}` : "--"}
        </span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-1.5">
        <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DiagnosticsPanel({ deviceId, device, latestTelemetry }: Props) {
  const [errors, setErrors] = useState<Array<{ id: string; command: string; status: string; result: unknown; createdAt: string }>>([]);
  const [auditEvents, setAuditEvents] = useState<Array<{ action: string; createdAt: string; details: unknown }>>([]);

  useEffect(() => {
    // Fetch failed commands
    fetch(`/api/devices/${deviceId}/command`)
      .then((r) => r.json())
      .then((cmds) => {
        const failed = (Array.isArray(cmds) ? cmds : []).filter(
          (c: Record<string, unknown>) => c.status === "failed" || c.status === "timeout"
        ).slice(0, 20);
        setErrors(failed);
      })
      .catch(console.error);

    // Fetch connection history from audit logs
    fetch(`/api/audit?deviceId=${deviceId}&range=7d&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setAuditEvents(data.logs || []);
      })
      .catch(console.error);
  }, [deviceId]);

  const t = latestTelemetry;
  const recommendations: string[] = [];
  if (t) {
    if (t.batteryLevel != null && t.batteryLevel < 20 && t.batteryLevel > 0) recommendations.push("Battery low - consider charging or switching to power mode: idle");
    if (t.cpuTemp != null && t.cpuTemp > 65) recommendations.push("CPU temperature elevated - consider reducing workload or improving ventilation");
    if (t.freeMemory != null && t.freeMemory < 50000) recommendations.push("Free memory critically low - risk of OOM crash. Reduce buffer sizes.");
    if (t.signalStrength != null && t.signalStrength < -100 && t.signalStrength !== 0) recommendations.push("Weak LTE signal - consider repositioning antenna or switching to WiFi-only mode");
  }
  if (device?.firmwareVersion === null) recommendations.push("Firmware version unknown - send get_status command to update");

  return (
    <div className="space-y-4">
      {/* Health Gauges */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">System Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <HealthGauge label="CPU Temperature" value={t?.cpuTemp ?? null} unit="C" max={85} warn={60} critical={75} icon={Thermometer} />
          <HealthGauge label="Free Memory" value={t?.freeMemory ? Math.round(t.freeMemory / 1024) : null} unit="KB" max={320} warn={100} critical={50} icon={HardDrive} />
          <HealthGauge label="Signal (dBm)" value={t?.signalStrength ?? null} unit="dBm" max={0} warn={-90} critical={-100} icon={Radio} />
          <HealthGauge label="Uptime" value={t?.uptimeSeconds ? Math.round(t.uptimeSeconds / 60) : null} unit="min" max={1440} warn={1200} critical={1400} icon={Clock} />
        </CardContent>
      </Card>

      {/* Device Info */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">Device Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-500">Status</div>
            <div><Badge variant={device?.status === "online" ? "default" : "secondary"}>{device?.status || "unknown"}</Badge></div>
            <div className="text-slate-500">Firmware</div>
            <div className="text-slate-300 font-mono">{device?.firmwareVersion || "N/A"}</div>
            <div className="text-slate-500">Last Heartbeat</div>
            <div className="text-slate-300">{device?.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toLocaleString() : "N/A"}</div>
            <div className="text-slate-500">Created</div>
            <div className="text-slate-300">{device?.createdAt ? new Date(device.createdAt).toLocaleDateString() : "N/A"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="bg-yellow-950/30 border-yellow-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {recommendations.map((r, i) => (
                <li key={i} className="text-xs text-yellow-300/80">{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Error Log */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">Error Log ({errors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" /> No errors in command history
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {errors.map((e) => (
                <div key={e.id} className="flex items-start gap-2 text-xs border-b border-slate-800 pb-2">
                  <Badge variant="destructive" className="text-[10px] shrink-0">{e.status}</Badge>
                  <div>
                    <span className="text-slate-300 font-mono">{e.command}</span>
                    {e.result && <p className="text-slate-500 mt-0.5">{JSON.stringify(e.result)}</p>}
                    <p className="text-slate-600">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection History */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">Connection History (7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEvents.length === 0 ? (
            <p className="text-xs text-slate-500">No connection events recorded</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {auditEvents.filter((e) => e.action === "device_connected" || e.action === "device_disconnected").map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={e.action === "device_connected" ? "text-emerald-400" : "text-red-400"}>
                    {e.action === "device_connected" ? "ONLINE" : "OFFLINE"}
                  </span>
                  <span className="text-slate-500">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
