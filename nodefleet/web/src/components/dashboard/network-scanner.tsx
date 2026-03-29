"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, WifiOff, Radio, Check, AlertCircle, Globe, Database, Zap } from "lucide-react";

interface DiscoveredDevice {
  ip: string;
  port: number;
  deviceId?: string;
  name?: string;
  status?: string;
  protocol: "websocket" | "udp" | "mdns" | "database";
  response: Record<string, unknown>;
  discoveredAt: string;
}

interface ScanResult {
  serverDiscoveryOnline: boolean;
  devices: DiscoveredDevice[];
  count: number;
  byProtocol: {
    websocket: number;
    udp: number;
    database: number;
  };
  scannedAt: string;
  message: string;
}

const protocolConfig = {
  websocket: { label: "WebSocket", icon: Zap, color: "text-green-400 border-green-500/30 bg-green-500/20" },
  udp: { label: "UDP", icon: Radio, color: "text-blue-400 border-blue-500/30 bg-blue-500/20" },
  mdns: { label: "mDNS", icon: Globe, color: "text-purple-400 border-purple-500/30 bg-purple-500/20" },
  database: { label: "Database", icon: Database, color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/20" },
};

export function NetworkScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/discovery");
      if (!res.ok) throw new Error("Scan failed");
      const data: ScanResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            Network Discovery
          </CardTitle>
          <Button
            className="bg-primary hover:bg-primary-dark gap-2"
            size="sm"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                Scan Network
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Scanning animation */}
        {scanning && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center">
                <Radio className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute -inset-4 rounded-full border border-primary/10 animate-ping" style={{ animationDelay: "0.5s" }} />
            </div>
            <p className="text-slate-400 text-sm">Scanning 3 protocols: WebSocket, UDP broadcast, Database...</p>
            <p className="text-slate-500 text-xs">Querying connected devices + broadcasting on port 5556 (3s timeout)</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="py-4 flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Results */}
        {result && !scanning && (
          <div className="space-y-4">
            {/* Server status + protocol summary */}
            <div className="flex flex-wrap items-center gap-2">
              {result.serverDiscoveryOnline ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                  <Check className="w-3 h-3" /> Discovery Service Online
                </Badge>
              ) : (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                  <WifiOff className="w-3 h-3" /> Discovery Service Offline
                </Badge>
              )}
              {result.count > 0 && (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  {result.count} device{result.count !== 1 ? "s" : ""} found
                </Badge>
              )}
              <span className="text-xs text-slate-500">
                Scanned at {new Date(result.scannedAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Protocol breakdown */}
            {result.count > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.byProtocol.websocket > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-green-400 border-green-500/30">
                    <Zap className="w-3 h-3" /> {result.byProtocol.websocket} via WebSocket
                  </Badge>
                )}
                {result.byProtocol.udp > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-blue-400 border-blue-500/30">
                    <Radio className="w-3 h-3" /> {result.byProtocol.udp} via UDP
                  </Badge>
                )}
                {result.byProtocol.database > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-yellow-400 border-yellow-500/30">
                    <Database className="w-3 h-3" /> {result.byProtocol.database} via Database
                  </Badge>
                )}
              </div>
            )}

            {/* Found devices */}
            {result.devices.length > 0 ? (
              <div className="space-y-2">
                {result.devices.map((device, idx) => {
                  const proto = protocolConfig[device.protocol] || protocolConfig.database;
                  const ProtoIcon = proto.icon;

                  return (
                    <div
                      key={device.deviceId || idx}
                      className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-white font-medium text-sm truncate">
                            {device.name || device.deviceId || device.ip}
                          </span>
                          {device.ip !== "ws-server" && device.ip !== "unknown" && (
                            <span className="text-slate-500 text-xs font-mono">{device.ip}</span>
                          )}
                        </div>
                        {device.deviceId && (
                          <p className="text-xs text-slate-400 mt-1 font-mono truncate">
                            ID: {device.deviceId}
                          </p>
                        )}
                        {device.response.hwModel && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Model: {String(device.response.hwModel)}
                          </p>
                        )}
                        {device.response.lastHeartbeat && (
                          <p className="text-xs text-slate-500">
                            Last heartbeat: {new Date(String(device.response.lastHeartbeat)).toLocaleTimeString()}
                          </p>
                        )}
                        {device.response.note && (
                          <p className="text-xs text-yellow-500/70 mt-0.5 italic">
                            {String(device.response.note)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant="outline" className={`text-xs gap-1 ${proto.color}`}>
                          <ProtoIcon className="w-3 h-3" />
                          {proto.label}
                        </Badge>
                        {device.status === "connected" && (
                          <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                            Live
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <WifiOff className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">{result.message}</p>
                <p className="text-slate-500 text-xs mt-2">
                  Ensure ESP32 devices are powered on, connected to the same LAN,
                  and running NodeFleet firmware with discovery enabled.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial state */}
        {!result && !scanning && !error && (
          <div className="py-2">
            <p className="text-slate-500 text-sm">
              Click "Scan Network" to discover devices using 3 redundant protocols:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              <li className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-green-400" /> <strong className="text-slate-400">WebSocket</strong> — Queries live connected devices
              </li>
              <li className="flex items-center gap-2">
                <Radio className="w-3 h-3 text-blue-400" /> <strong className="text-slate-400">UDP Broadcast</strong> — Scans LAN on port 5556
              </li>
              <li className="flex items-center gap-2">
                <Database className="w-3 h-3 text-yellow-400" /> <strong className="text-slate-400">Database</strong> — Known online devices as fallback
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
