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
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";
import { DeviceStatusBadge } from "@/components/dashboard/device-status-badge";
import dynamic from "next/dynamic";
import { useState } from "react";

const DeviceMap = dynamic(
  () => import("@/components/dashboard/device-map").then((mod) => mod.DeviceMap),
  { ssr: false, loading: () => (
    <div className="w-full h-[500px] bg-slate-900 rounded-lg flex items-center justify-center">
      <p className="text-slate-500">Loading map...</p>
    </div>
  )}
);

const devices = [
  {
    id: 1,
    name: "GPS Camera 01",
    status: "online" as const,
    latitude: 37.7749,
    longitude: -122.4194,
    lastUpdate: "2 minutes ago",
    accuracy: "±8m",
  },
  {
    id: 2,
    name: "Sensor Unit 15",
    status: "online" as const,
    latitude: 34.0522,
    longitude: -118.2437,
    lastUpdate: "5 minutes ago",
    accuracy: "±12m",
  },
  {
    id: 3,
    name: "Audio Logger 08",
    status: "offline" as const,
    latitude: 41.8781,
    longitude: -87.6298,
    lastUpdate: "45 minutes ago",
    accuracy: "±15m",
  },
  {
    id: 4,
    name: "Fleet Monitor 03",
    status: "online" as const,
    latitude: 29.7604,
    longitude: -95.3698,
    lastUpdate: "1 minute ago",
    accuracy: "±6m",
  },
];

const trail = [
  { lat: 37.7750, lng: -122.4220 },
  { lat: 37.7741, lng: -122.4210 },
  { lat: 37.7738, lng: -122.4195 },
  { lat: 37.7745, lng: -122.4185 },
  { lat: 37.7749, lng: -122.4194 },
];

export default function MapPage() {
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);

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
              {devices.length} devices tracked
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeviceMap
            devices={devices}
            trail={trail}
            selectedDeviceId={selectedDevice}
          />
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
                {devices.map((device) => (
                  <TableRow
                    key={device.id}
                    className={`hover:bg-slate-800/50 cursor-pointer ${
                      selectedDevice === device.id ? "bg-primary/10" : ""
                    }`}
                    onClick={() => setSelectedDevice(
                      selectedDevice === device.id ? null : device.id
                    )}
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
        </CardContent>
      </Card>
    </div>
  );
}
