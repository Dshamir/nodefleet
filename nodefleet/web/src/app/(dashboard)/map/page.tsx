"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { DeviceStatusBadge } from "@/components/dashboard/device-status-badge";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";

const DeviceMap = dynamic(
  () => import("@/components/dashboard/device-map").then((mod) => mod.DeviceMap),
  { ssr: false, loading: () => (
    <div className="w-full h-[50vh] min-h-[300px] bg-slate-900 rounded-lg flex items-center justify-center">
      <p className="text-slate-500">Loading map...</p>
    </div>
  )}
);

interface DeviceFromAPI {
  id: string;
  name: string;
  status: "online" | "offline" | "pairing" | "disabled";
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface GpsRecordFromAPI {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  satellites: number | null;
  timestamp: string;
}

interface DeviceLocation {
  id: string;
  name: string;
  status: "online" | "offline" | "pairing" | "disabled";
  latitude: number;
  longitude: number;
  lastUpdate: string;
  accuracy: string;
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (isNaN(diffMs) || diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MapPage() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [deviceLocations, setDeviceLocations] = useState<DeviceLocation[]>([]);
  const [trail, setTrail] = useState<{ lat: number; lng: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [trailLoading, setTrailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch devices and their latest GPS positions on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchDevicesWithGps() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/devices?limit=100");
        if (!res.ok) throw new Error("Failed to fetch devices");

        const json = await res.json();
        const allDevices: DeviceFromAPI[] = json.data ?? [];

        // Filter out devices that are still pairing (no GPS expected)
        const trackable = allDevices.filter((d) => d.status !== "pairing");

        // Fetch latest GPS record for each trackable device
        const locationPromises = trackable.map(async (device) => {
          try {
            const gpsRes = await fetch(
              `/api/devices/${device.id}/gps?limit=1`
            );
            if (!gpsRes.ok) return null;

            const gpsJson = await gpsRes.json();
            const records: GpsRecordFromAPI[] = gpsJson.data ?? [];

            if (records.length === 0) return null;

            const latest = records[0];

            return {
              id: device.id,
              name: device.name,
              status: device.status,
              latitude: latest.latitude,
              longitude: latest.longitude,
              lastUpdate: timeAgo(latest.timestamp),
              accuracy:
                latest.accuracy != null
                  ? `\u00b1${Math.round(latest.accuracy)}m`
                  : "N/A",
            } satisfies DeviceLocation;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(locationPromises);

        if (!cancelled) {
          setDeviceLocations(
            results.filter((r): r is DeviceLocation => r !== null)
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "An error occurred");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDevicesWithGps();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch GPS trail when a device is selected
  const fetchTrail = useCallback(async (deviceId: string) => {
    setTrailLoading(true);
    setTrail([]);

    try {
      const res = await fetch(`/api/devices/${deviceId}/gps?limit=20`);
      if (!res.ok) return;

      const json = await res.json();
      const records: GpsRecordFromAPI[] = json.data ?? [];

      // API returns newest first; reverse so trail goes oldest -> newest
      const points = records
        .slice()
        .reverse()
        .map((r) => ({ lat: r.latitude, lng: r.longitude }));

      setTrail(points);
    } catch {
      // silently ignore trail fetch errors
    } finally {
      setTrailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchTrail(selectedDevice);
    } else {
      setTrail([]);
    }
  }, [selectedDevice, fetchTrail]);

  // Map-compatible devices (DeviceMap expects numeric id field; use index as fallback)
  const mapDevices = deviceLocations.map((d, idx) => ({
    id: idx + 1,
    name: d.name,
    status: d.status,
    latitude: d.latitude,
    longitude: d.longitude,
    lastUpdate: d.lastUpdate,
  }));

  const selectedIdx = selectedDevice
    ? deviceLocations.findIndex((d) => d.id === selectedDevice)
    : -1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">GPS Map</h1>
        <p className="text-slate-400">Track your device fleet locations</p>
      </div>

      {/* Interactive Map */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Fleet Map
            <span className="text-sm font-normal text-slate-400 ml-2">
              {loading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading devices...
                </span>
              ) : (
                `${deviceLocations.length} devices tracked`
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="w-full h-[50vh] min-h-[300px] bg-slate-900 rounded-lg flex items-center justify-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : loading ? (
            <div className="w-full h-[50vh] min-h-[300px] bg-slate-900 rounded-lg flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
          ) : (
            <DeviceMap
              devices={mapDevices}
              trail={trail}
              selectedDeviceId={selectedIdx >= 0 ? selectedIdx + 1 : null}
            />
          )}
          {trailLoading && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading GPS trail...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Device Locations Table */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            Device Coordinates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : deviceLocations.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No devices with GPS data found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latitude</TableHead>
                    <TableHead>Longitude</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deviceLocations.map((device) => (
                    <TableRow
                      key={device.id}
                      className={`hover:bg-slate-800/50 cursor-pointer ${
                        selectedDevice === device.id ? "bg-primary/10" : ""
                      }`}
                      onClick={() =>
                        setSelectedDevice(
                          selectedDevice === device.id ? null : device.id
                        )
                      }
                    >
                      <TableCell className="font-medium text-white">
                        {device.name}
                      </TableCell>
                      <TableCell>
                        <DeviceStatusBadge status={device.status} />
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm font-mono">
                        {device.latitude.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm font-mono">
                        {device.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {device.accuracy}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {device.lastUpdate}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
