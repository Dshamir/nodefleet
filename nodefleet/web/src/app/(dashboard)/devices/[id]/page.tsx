"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { DeviceStatusBadge } from "@/components/dashboard/device-status-badge";
import {
  Activity,
  Battery,
  Signal,
  Thermometer,
  Zap,
  Send,
  Download,
} from "lucide-react";

export default function DeviceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [commandType, setCommandType] = useState("capture_photo");
  const [customCommand, setCustomCommand] = useState("");

  const deviceId = params.id;

  // Mock device data
  const device = {
    id: deviceId,
    name: "GPS Camera 01",
    status: "online" as const,
    model: "ESP32-CAM",
    serialNumber: "SN-2024-00001",
    lastSeen: "2 minutes ago",
    firmware: "v2.3.1",
    battery: 87,
    signal: -45,
    cpuTemp: 42,
    memory: 78,
  };

  const telemetry = [
    { timestamp: "14:32:15", battery: 87, signal: -45, temp: 42 },
    { timestamp: "14:28:42", battery: 88, signal: -43, temp: 41 },
    { timestamp: "14:25:09", battery: 89, signal: -46, temp: 40 },
    { timestamp: "14:21:30", battery: 90, signal: -44, temp: 41 },
  ];

  const gpsTrail = [
    { timestamp: "14:35:22", latitude: "37.7749", longitude: "-122.4194" },
    { timestamp: "14:32:15", latitude: "37.7745", longitude: "-122.4185" },
    { timestamp: "14:28:42", latitude: "37.7738", longitude: "-122.4195" },
    { timestamp: "14:25:09", latitude: "37.7741", longitude: "-122.4210" },
  ];

  const media = [
    { id: 1, name: "photo_001.jpg", type: "image", size: "2.4 MB", date: "2024-01-15 14:32" },
    { id: 2, name: "photo_002.jpg", type: "image", size: "2.1 MB", date: "2024-01-15 14:28" },
    { id: 3, name: "video_001.mp4", type: "video", size: "45.2 MB", date: "2024-01-15 14:20" },
    { id: 4, name: "audio_001.wav", type: "audio", size: "1.8 MB", date: "2024-01-15 14:15" },
  ];

  const commandHistory = [
    { id: 1, command: "capture_photo", status: "success", timestamp: "14:35:22" },
    { id: 2, command: "record_audio", status: "success", timestamp: "14:32:15" },
    { id: 3, command: "reboot", status: "success", timestamp: "14:28:42" },
    { id: 4, command: "capture_video", status: "failed", timestamp: "14:25:09" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{device.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>Model: {device.model}</span>
            <span>SN: {device.serialNumber}</span>
            <DeviceStatusBadge status={device.status} />
          </div>
        </div>
      </div>

      {/* Telemetry Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Battery</p>
                <p className="text-2xl font-bold text-white">{device.battery}%</p>
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
                <p className="text-2xl font-bold text-white">{device.signal} dBm</p>
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
                <p className="text-2xl font-bold text-white">{device.cpuTemp}°C</p>
              </div>
              <Thermometer className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Memory</p>
                <p className="text-2xl font-bold text-white">{device.memory}%</p>
              </div>
              <Zap className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gps">GPS Trail</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Status</p>
                  <DeviceStatusBadge status={device.status} />
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Last Seen</p>
                  <p className="text-white font-medium">{device.lastSeen}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Firmware Version</p>
                  <p className="text-white font-medium">{device.firmware}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Serial Number</p>
                  <p className="text-white font-medium">{device.serialNumber}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GPS Trail Tab */}
        <TabsContent value="gps" className="space-y-6 mt-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>GPS Trail History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Latitude</TableHead>
                      <TableHead>Longitude</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gpsTrail.map((entry) => (
                      <TableRow key={entry.timestamp}>
                        <TableCell className="text-sm">{entry.timestamp}</TableCell>
                        <TableCell className="text-sm">{entry.latitude}</TableCell>
                        <TableCell className="text-sm">{entry.longitude}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Map integration requires Leaflet or Mapbox integration
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media" className="space-y-6 mt-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Captured Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {media.map((file) => (
                  <div
                    key={file.id}
                    className="p-4 bg-slate-900/30 rounded-lg border border-slate-800 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-white mb-1">{file.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {file.type}
                          </Badge>
                          <span className="text-xs text-slate-400">{file.size}</span>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">{file.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands" className="space-y-6 mt-6">
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
                      <SelectItem value="update_firmware">Update Firmware</SelectItem>
                      <SelectItem value="custom">Custom Command</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {commandType === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Command
                    </label>
                    <Input
                      placeholder="Enter custom command"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                )}

                <Button className="w-full bg-primary hover:bg-primary-dark gap-2">
                  <Send className="w-4 h-4" />
                  Send Command
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Command History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Command</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{entry.command}</TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.status === "success" ? "success" : "destructive"}
                          >
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-400">
                          {entry.timestamp}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Telemetry Tab */}
        <TabsContent value="telemetry" className="space-y-6 mt-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Telemetry Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 mb-4">
                Recharts integration required for live charts. Showing raw telemetry data:
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Battery %</TableHead>
                      <TableHead>Signal dBm</TableHead>
                      <TableHead>Temp °C</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {telemetry.map((entry) => (
                      <TableRow key={entry.timestamp}>
                        <TableCell className="text-sm">{entry.timestamp}</TableCell>
                        <TableCell className="text-sm">{entry.battery}%</TableCell>
                        <TableCell className="text-sm">{entry.signal} dBm</TableCell>
                        <TableCell className="text-sm">{entry.temp}°C</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
