"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeviceStatusBadge } from "@/components/dashboard/device-status-badge";
import { TelemetryCharts } from "@/components/dashboard/device/telemetry-charts";
import { FeatureToggles } from "@/components/dashboard/device/feature-toggles";
import { DiagnosticsPanel } from "@/components/dashboard/device/diagnostics-panel";
import {
  ArrowLeft,
  Send,
  Loader2,
  Battery,
  Signal,
  Thermometer,
  Cpu,
  RotateCcw,
  Power,
  Settings2,
  Activity,
  AlertTriangle,
  MapPin,
  Satellite,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  name: string;
  hwModel: string;
  serialNumber: string;
  pairingCode: string | null;
  status: "online" | "offline" | "pairing" | "disabled";
  firmwareVersion: string | null;
  lastHeartbeatAt: string | null;
  lastIp: string | null;
  fleetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface FleetInfo {
  id: string;
  name: string;
}

interface TelemetryRecord {
  id: string;
  timestamp: string;
  batteryLevel: number | null;
  signalStrength: number | null;
  cpuTemp: number | null;
  freeMemory: number | null;
  uptimeSeconds: number | null;
}

interface GpsRecord {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  accuracy: number | null;
}

interface CommandRecord {
  id: string;
  command: string;
  status: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "N/A";
  const now = Date.now();
  const then = new Date(dateString).getTime();
  if (isNaN(then)) return "N/A";
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return seconds <= 1 ? "just now" : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hr ago" : `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function formatTimestamp(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString();
  } catch {
    return dateString;
  }
}

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// GPS Status Card — visual indicator + calibration + help
// ---------------------------------------------------------------------------

function GpsStatusCard({
  device,
  gps,
  deviceId,
  onRefresh,
}: {
  device: Device | null;
  gps: GpsRecord[];
  deviceId: string;
  onRefresh: () => void;
}) {
  const [calibrating, setCalibrating] = useState(false);
  const [calibrateMsg, setCalibrateMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Determine GPS status from data
  const latestFix = gps.length > 0 ? gps[0] : null;
  const fixAge = latestFix
    ? Math.round((Date.now() - new Date(latestFix.timestamp).getTime()) / 1000)
    : null;
  const isStale = fixAge !== null && fixAge > 300; // older than 5 minutes
  const isVeryStale = fixAge !== null && fixAge > 86400; // older than 1 day
  const isOnline = device?.status === "online";

  let statusColor = "bg-red-500/20 text-red-400 border-red-500/30";
  let statusIcon = <AlertTriangle className="w-4 h-4" />;
  let statusText = "No GPS Data";

  if (latestFix && !isVeryStale) {
    statusColor = "bg-green-500/20 text-green-400 border-green-500/30";
    statusIcon = <Satellite className="w-4 h-4" />;
    statusText = "GPS Active";
  } else if (latestFix && isVeryStale) {
    statusColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    statusIcon = <AlertTriangle className="w-4 h-4" />;
    statusText = "GPS Stale";
  }

  function formatAge(seconds: number): string {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
    return `${Math.round(seconds / 86400)}d ago`;
  }

  async function handleCalibrate() {
    setCalibrating(true);
    setCalibrateMsg(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "restart_gnss",
          payload: { source: "gps_tab" },
        }),
      });
      if (res.ok) {
        setCalibrateMsg("GNSS restart command sent. The device will attempt to reacquire satellites. This can take 1\u20135 minutes.");
      } else {
        setCalibrateMsg("Failed to send command. Is the device online?");
      }
    } catch {
      setCalibrateMsg("Could not reach the server.");
    } finally {
      setCalibrating(false);
    }
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Status badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${statusColor}`}>
            {statusIcon}
            <span className="text-sm font-medium">{statusText}</span>
          </div>

          {/* Fix details */}
          <div className="flex-1 text-sm text-slate-400 space-y-1">
            {latestFix ? (
              <>
                <p>
                  Last fix: <span className="text-slate-300">{formatAge(fixAge!)}</span>
                  {" \u2014 "}
                  <span className="font-mono text-slate-300">
                    {latestFix.latitude.toFixed(4)}, {latestFix.longitude.toFixed(4)}
                  </span>
                </p>
                {isStale && (
                  <p className="text-yellow-400 text-xs">
                    GPS data is outdated. The device may be indoors, powered off, or the GNSS module needs a restart.
                  </p>
                )}
              </>
            ) : (
              <p>No GPS records found for this device.</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-slate-700"
              onClick={onRefresh}
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-slate-700"
              onClick={handleCalibrate}
              disabled={calibrating || !isOnline}
              title={!isOnline ? "Device must be online to calibrate GPS" : "Restart the GNSS module on the device"}
            >
              {calibrating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Satellite className="w-3 h-3" />
              )}
              Calibrate GPS
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-slate-400"
              onClick={() => setShowHelp(!showHelp)}
            >
              <Info className="w-3 h-3" />
              {showHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Calibrate result message */}
        {calibrateMsg && (
          <p className={`mt-3 text-sm ${calibrateMsg.includes("Failed") || calibrateMsg.includes("Could not") ? "text-red-400" : "text-blue-400"}`}>
            {calibrateMsg}
          </p>
        )}

        {/* Help section */}
        {showHelp && (
          <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300 space-y-3">
            <p className="font-medium text-slate-200">GPS Troubleshooting</p>
            <div className="space-y-2">
              <p><strong>No GPS data at all?</strong> The device needs to be powered on, connected to NodeFleet, and have the GPS module enabled. Check the device status badge at the top of this page.</p>
              <p><strong>GPS data is old / stale?</strong> The GPS module may have lost its satellite connection. Try these steps:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-slate-400">
                <li>Click <strong>Calibrate GPS</strong> above \u2014 this restarts the GPS module on the device.</li>
                <li>Make sure the device has a <strong>clear view of the sky</strong> (near a window or outdoors). GPS does not work well indoors.</li>
                <li>Wait <strong>1\u20135 minutes</strong> after calibrating. The first satellite fix after a restart takes time (cold start).</li>
                <li>If still no data after 5 minutes, try <strong>rebooting the device</strong> from the Commands tab.</li>
              </ol>
              <p><strong>Accuracy is low?</strong> Move the device to a location with open sky. Buildings, trees, and metal roofs can block GPS signals.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeviceDetailPage() {
  const params = useParams();
  const deviceId = params.id as string;

  // State
  const [device, setDevice] = useState<Device | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([]);
  const [gps, setGps] = useState<GpsRecord[]>([]);
  const [commands, setCommands] = useState<CommandRecord[]>([]);

  const [fleets, setFleets] = useState<FleetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFleet, setUpdatingFleet] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Command form
  const [commandType, setCommandType] = useState("capture_photo");
  const [customPayload, setCustomPayload] = useState("");
  const [sendingCommand, setSendingCommand] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [commandSuccess, setCommandSuccess] = useState<string | null>(null);

  // ------ Fetch data ------

  const fetchDevice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}`);
      if (!res.ok) throw new Error(`Failed to load device (${res.status})`);
      const json = await res.json();
      setDevice(json.device);
      // The detail endpoint returns recent telemetry & GPS inline
      if (json.recentTelemetry) setTelemetry(json.recentTelemetry);
      if (json.recentGps) setGps(json.recentGps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device");
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/telemetry?limit=20`);
      if (!res.ok) return;
      const json = await res.json();
      setTelemetry(json.data || []);
    } catch {
      // non-critical
    }
  }, [deviceId]);

  const fetchGps = useCallback(async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/gps?limit=20`);
      if (!res.ok) return;
      const json = await res.json();
      setGps(json.data || []);
    } catch {
      // non-critical
    }
  }, [deviceId]);

  const fetchFleets = useCallback(async () => {
    try {
      const res = await fetch("/api/fleets");
      if (!res.ok) return;
      const json = await res.json();
      setFleets((json.data || []).map((f: FleetInfo) => ({ id: f.id, name: f.name })));
    } catch {}
  }, []);

  useEffect(() => {
    fetchFleets();
    fetchDevice().then(() => {
      fetchTelemetry();
      fetchGps();
    });
  }, [fetchDevice, fetchTelemetry, fetchGps, fetchFleets]);

  async function handleChangeFleet(fleetId: string) {
    setUpdatingFleet(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fleetId: fleetId === "none" ? null : fleetId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDevice((prev) => prev ? { ...prev, fleetId: updated.fleetId } : prev);
      }
    } catch {}
    finally { setUpdatingFleet(false); }
  }

  async function handleRegeneratePairingCode() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regeneratePairingCode: true }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDevice((prev) => prev ? { ...prev, pairingCode: updated.pairingCode, status: updated.status } : prev);
      }
    } catch {}
    finally { setRegenerating(false); }
  }

  // ------ Send Command ------

  async function handleSendCommand() {
    setSendingCommand(true);
    setCommandError(null);
    setCommandSuccess(null);
    try {
      const payload: Record<string, unknown> = {};
      if (commandType === "custom" && customPayload.trim()) {
        try {
          Object.assign(payload, JSON.parse(customPayload));
        } catch {
          payload.raw = customPayload.trim();
        }
      }

      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandType, payload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const result = await res.json();
      setCommandSuccess(`Command sent (ID: ${result.id})`);
      // Add to local history
      setCommands((prev) => [
        {
          id: result.id,
          command: result.command,
          status: result.status || "pending",
          createdAt: new Date().toISOString(),
          payload: result.payload || null,
        },
        ...prev,
      ]);
      setTimeout(() => setCommandSuccess(null), 4000);
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : "Failed to send command");
    } finally {
      setSendingCommand(false);
    }
  }

  // ------ Latest telemetry values for gauge cards ------
  const latest = telemetry.length > 0 ? telemetry[0] : null;

  // ------ Render ------

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading device...
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="p-6 space-y-4">
        <Link
          href="/devices"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Devices
        </Link>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <p className="text-red-400">{error || "Device not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back link & Header */}
      <Link
        href="/devices"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Devices
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{device.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>Model: {device.hwModel}</span>
            <span>SN: {device.serialNumber}</span>
            <DeviceStatusBadge status={device.status} />
          </div>
        </div>
      </div>

      {/* Live gauge cards */}
      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Battery</p>
                  <p className="text-2xl font-bold text-white">
                    {latest.batteryLevel != null ? `${latest.batteryLevel}%` : "--"}
                  </p>
                </div>
                <Battery className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Signal</p>
                  <p className="text-2xl font-bold text-white">
                    {latest.signalStrength != null
                      ? `${latest.signalStrength} dBm`
                      : "--"}
                  </p>
                </div>
                <Signal className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">CPU Temp</p>
                  <p className="text-2xl font-bold text-white">
                    {latest.cpuTemp != null ? `${latest.cpuTemp.toFixed(1)} C` : "--"}
                  </p>
                </div>
                <Thermometer className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Free Memory</p>
                  <p className="text-2xl font-bold text-white">
                    {latest.freeMemory != null
                      ? `${(latest.freeMemory / 1024).toFixed(0)} KB`
                      : "--"}
                  </p>
                </div>
                <Cpu className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
          <TabsTrigger value="gps">GPS</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ---- Overview Tab ---- */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoField label="Device Name" value={device.name} />
                <InfoField label="Hardware Model" value={device.hwModel} />
                <InfoField label="Serial Number" value={device.serialNumber} />
                <div>
                  <p className="text-sm text-slate-400 mb-1">Status</p>
                  <DeviceStatusBadge status={device.status} />
                </div>
                <InfoField
                  label="Firmware Version"
                  value={device.firmwareVersion || "N/A"}
                />
                <div>
                  <p className="text-sm text-slate-400 mb-1">Fleet</p>
                  <Select value={device.fleetId || "none"} onValueChange={handleChangeFleet} disabled={updatingFleet}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="none">No Fleet</SelectItem>
                      {fleets.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Pairing Code</p>
                  <div className="flex items-center gap-2">
                    <code className="text-white font-mono font-medium tracking-wider">{device.pairingCode || "—"}</code>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleRegeneratePairingCode} disabled={regenerating}>
                      {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      New Code
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {device.status === "pairing" ? "Waiting for device to pair (24hr expiry)" : "Generate new code to re-pair"}
                  </p>
                </div>
                <InfoField
                  label="Last Heartbeat"
                  value={formatRelativeTime(device.lastHeartbeatAt)}
                />
                <InfoField label="Last IP" value={device.lastIp || "N/A"} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Telemetry Tab ---- */}
        {/* Charts are rendered above the table */}
        <TabsContent value="telemetry" className="space-y-6 mt-6">
          {/* Telemetry Charts */}
          <TelemetryCharts deviceId={deviceId} />

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Telemetry History (Raw)</CardTitle>
            </CardHeader>
            <CardContent>
              {telemetry.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No telemetry data available
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Battery</TableHead>
                        <TableHead>Signal</TableHead>
                        <TableHead>CPU Temp</TableHead>
                        <TableHead>Free Memory</TableHead>
                        <TableHead>Uptime</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {telemetry.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm text-slate-300">
                            {formatTimestamp(r.timestamp)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.batteryLevel != null ? `${r.batteryLevel}%` : "--"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.signalStrength != null
                              ? `${r.signalStrength} dBm`
                              : "--"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.cpuTemp != null ? `${r.cpuTemp.toFixed(1)} C` : "--"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.freeMemory != null
                              ? `${(r.freeMemory / 1024).toFixed(0)} KB`
                              : "--"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatUptime(r.uptimeSeconds)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- GPS Tab ---- */}
        <TabsContent value="gps" className="space-y-6 mt-6">
          {/* GPS Status Indicator */}
          <GpsStatusCard device={device} gps={gps} deviceId={deviceId} onRefresh={fetchGps} />

          {/* GPS Trail */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                GPS Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gps.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No GPS data available
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Latitude</TableHead>
                        <TableHead>Longitude</TableHead>
                        <TableHead>Altitude</TableHead>
                        <TableHead>Speed</TableHead>
                        <TableHead>Accuracy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gps.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm text-slate-300">
                            {formatTimestamp(r.timestamp)}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {r.latitude.toFixed(6)}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {r.longitude.toFixed(6)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.altitude != null ? `${r.altitude.toFixed(1)} m` : "--"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.speed != null ? `${r.speed.toFixed(1)} m/s` : "--"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.accuracy != null ? `${r.accuracy.toFixed(1)} m` : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Commands Tab ---- */}
        <TabsContent value="commands" className="space-y-6 mt-6">
          {/* Send Command */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Send Command</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Command Type
                  </label>
                  <Select value={commandType} onValueChange={setCommandType}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="capture_photo">Capture Photo</SelectItem>
                      <SelectItem value="capture_video">Capture Video</SelectItem>
                      <SelectItem value="record_audio">Record Audio</SelectItem>
                      <SelectItem value="reboot">Reboot Device</SelectItem>
                      <SelectItem value="custom">Custom Command</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {commandType === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Payload (JSON or text)
                    </label>
                    <Input
                      placeholder='e.g. {"action": "diagnostics"}'
                      value={customPayload}
                      onChange={(e) => setCustomPayload(e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                )}

                {commandError && (
                  <p className="text-sm text-red-400">{commandError}</p>
                )}
                {commandSuccess && (
                  <p className="text-sm text-green-400">{commandSuccess}</p>
                )}

                <Button
                  className="w-full bg-primary hover:bg-primary-dark gap-2"
                  onClick={handleSendCommand}
                  disabled={sendingCommand}
                >
                  {sendingCommand ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Command
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Command History */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Command History</CardTitle>
            </CardHeader>
            <CardContent>
              {commands.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No commands sent yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Command</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commands.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm font-mono">
                            {c.command}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                c.status === "completed"
                                  ? "bg-success/20 text-success border-success/30"
                                  : c.status === "failed"
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              }
                            >
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-400">
                            {formatTimestamp(c.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Diagnostics Tab ── */}
        <TabsContent value="diagnostics" className="space-y-6 mt-6">
          <DiagnosticsPanel
            deviceId={deviceId}
            device={device}
            latestTelemetry={telemetry.length > 0 ? telemetry[0] : null}
          />
        </TabsContent>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <FeatureToggles deviceId={deviceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper component
// ---------------------------------------------------------------------------

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}
