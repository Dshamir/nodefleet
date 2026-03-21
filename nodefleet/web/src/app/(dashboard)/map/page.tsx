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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";
import { DeviceStatusBadge } from "@/components/dashboard/device-status-badge";

export default function MapPage() {
  const devices = [
    {
      id: 1,
      name: "GPS Camera 01",
      status: "online" as const,
      latitude: "37.7749",
      longitude: "-122.4194",
      lastUpdate: "2 minutes ago",
      accuracy: "±8m",
    },
    {
      id: 2,
      name: "Sensor Unit 15",
      status: "online" as const,
      latitude: "34.0522",
      longitude: "-118.2437",
      lastUpdate: "5 minutes ago",
      accuracy: "±12m",
    },
    {
      id: 3,
      name: "Audio Logger 08",
      status: "offline" as const,
      latitude: "41.8781",
      longitude: "-87.6298",
      lastUpdate: "45 minutes ago",
      accuracy: "±15m",
    },
    {
      id: 4,
      name: "Fleet Monitor 03",
      status: "online" as const,
      latitude: "29.7604",
      longitude: "-95.3698",
      lastUpdate: "1 minute ago",
      accuracy: "±6m",
    },
    {
      id: 5,
      name: "Mobile Unit 12",
      status: "pairing" as const,
      latitude: "N/A",
      longitude: "N/A",
      lastUpdate: "N/A",
      accuracy: "N/A",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">GPS Map</h1>
        <p className="text-slate-400">Track your device fleet locations</p>
      </div>

      {/* Map Placeholder */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Interactive Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-96 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 font-medium mb-2">
                Map Integration Required
              </p>
              <p className="text-slate-500 text-sm mb-4">
                Requires Leaflet or Mapbox integration
              </p>
              <code className="text-xs text-slate-400 bg-slate-950/50 px-3 py-1 rounded">
                npm install leaflet
              </code>
            </div>
          </div>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id} className="hover:bg-slate-800/50">
                    <TableCell className="font-medium text-white">
                      {device.name}
                    </TableCell>
                    <TableCell>
                      <DeviceStatusBadge status={device.status} />
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {device.latitude}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {device.longitude}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {device.accuracy}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {device.lastUpdate}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary hover:text-primary-light"
                      >
                        View Trail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* GPS Trail Sample */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle>GPS Trail History (GPS Camera 01)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Altitude</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { time: "14:35:22", lat: "37.7749", lng: "-122.4194", acc: "±8m", alt: "42m" },
                  { time: "14:32:15", lat: "37.7745", lng: "-122.4185", acc: "±10m", alt: "41m" },
                  { time: "14:28:42", lat: "37.7738", lng: "-122.4195", acc: "±9m", alt: "40m" },
                  { time: "14:25:09", lat: "37.7741", lng: "-122.4210", acc: "±11m", alt: "39m" },
                  { time: "14:21:30", lat: "37.7750", lng: "-122.4220", acc: "±7m", alt: "42m" },
                ].map((entry, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-800/50">
                    <TableCell className="text-sm">{entry.time}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{entry.lat}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{entry.lng}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{entry.acc}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{entry.alt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Integration Info */}
      <Card className="bg-primary/10 border-primary/30">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-primary mb-2">Map Integration</h3>
          <p className="text-sm text-slate-300 mb-4">
            This page displays GPS coordinates in table format. To add interactive map visualization:
          </p>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li>Install Leaflet: <code className="text-xs bg-slate-950/50 px-2 py-1 rounded">npm install leaflet react-leaflet</code></li>
            <li>Or use Mapbox: <code className="text-xs bg-slate-950/50 px-2 py-1 rounded">npm install mapbox-gl react-map-gl</code></li>
            <li>Render markers for each device's GPS coordinates</li>
            <li>Display GPS trails as polylines on the map</li>
            <li>Implement click handlers to view device details</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
