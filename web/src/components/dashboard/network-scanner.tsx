"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, WifiOff, Radio, Check, AlertCircle } from "lucide-react";

interface DiscoveredDevice {
  ip: string;
  port: number;
  response: Record<string, unknown>;
  discoveredAt: string;
}

interface ScanResult {
  serverDiscoveryOnline: boolean;
  devices: DiscoveredDevice[];
  scannedAt: string;
  message: string;
}

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
            <p className="text-slate-400 text-sm">Broadcasting UDP discovery on port 5556...</p>
            <p className="text-slate-500 text-xs">Listening for ESP32 responses (3 second timeout)</p>
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
            {/* Server status */}
            <div className="flex items-center gap-2">
              {result.serverDiscoveryOnline ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                  <Check className="w-3 h-3" /> Discovery Service Online
                </Badge>
              ) : (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                  <WifiOff className="w-3 h-3" /> Discovery Service Offline
                </Badge>
              )}
              <span className="text-xs text-slate-500">
                Scanned at {new Date(result.scannedAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Found devices */}
            {result.devices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-300 font-medium">
                  Found {result.devices.length} device(s):
                </p>
                {result.devices.map((device, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-green-400" />
                        <span className="text-white font-mono text-sm">{device.ip}</span>
                        <span className="text-slate-500 text-xs">:{device.port}</span>
                      </div>
                      {device.response.serialNumber && (
                        <p className="text-xs text-slate-400 mt-1">
                          Serial: {String(device.response.serialNumber)}
                          {device.response.hwModel && ` — ${String(device.response.hwModel)}`}
                        </p>
                      )}
                      {device.response.firmware && (
                        <p className="text-xs text-slate-500">
                          Firmware: {String(device.response.firmware)}
                        </p>
                      )}
                      {device.response.raw && (
                        <p className="text-xs text-slate-500 font-mono truncate max-w-md">
                          {String(device.response.raw)}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                      Reachable
                    </Badge>
                  </div>
                ))}
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
          <p className="text-slate-500 text-sm py-2">
            Click "Scan Network" to broadcast a UDP discovery probe and find ESP32 devices on your local network.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
