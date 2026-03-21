"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeviceStatusBadge } from "@/components/dashboard/device-status-badge";
import { Plus, Copy, Check, Search } from "lucide-react";

export default function DevicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const pairingCode = "DEV-2024-ABC123XYZ";

  const devices = [
    {
      id: 1,
      name: "GPS Camera 01",
      model: "ESP32-CAM",
      status: "online" as const,
      lastHeartbeat: "2 min ago",
      battery: "87%",
      signal: "-45 dBm",
    },
    {
      id: 2,
      name: "Sensor Unit 15",
      model: "ESP32-S3",
      status: "online" as const,
      lastHeartbeat: "5 min ago",
      battery: "94%",
      signal: "-52 dBm",
    },
    {
      id: 3,
      name: "Audio Logger 08",
      model: "ESP32-Lite",
      status: "offline" as const,
      lastHeartbeat: "45 min ago",
      battery: "32%",
      signal: "N/A",
    },
    {
      id: 4,
      name: "Fleet Monitor 03",
      model: "ESP32-CAM",
      status: "online" as const,
      lastHeartbeat: "1 min ago",
      battery: "76%",
      signal: "-38 dBm",
    },
    {
      id: 5,
      name: "Mobile Unit 12",
      model: "ESP32-S3",
      status: "pairing" as const,
      lastHeartbeat: "N/A",
      battery: "N/A",
      signal: "N/A",
    },
  ];

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(search.toLowerCase()) ||
      device.model.toLowerCase().includes(search.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && device.status === statusFilter;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Devices</h1>
          <p className="text-slate-400">Manage your IoT device fleet</p>
        </div>
        <Dialog open={addDeviceOpen} onOpenChange={setAddDeviceOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary-dark gap-2">
              <Plus className="w-5 h-5" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
              <DialogDescription>
                Register a new device to your fleet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Device Name
                </label>
                <Input
                  placeholder="e.g. GPS Camera 01"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <p className="text-sm text-slate-400 mb-2">Pairing Code</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-950 rounded border border-slate-700 text-white font-mono text-sm">
                    {pairingCode}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyCode}
                  >
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Enter this code on your ESP32 device to pair it
                </p>
              </div>
              <Button className="w-full bg-primary hover:bg-primary-dark">
                Continue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search devices by name or model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-800 border-slate-700 pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="online">Online Only</SelectItem>
                <SelectItem value="offline">Offline Only</SelectItem>
                <SelectItem value="pairing">Pairing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Heartbeat</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.length > 0 ? (
                filteredDevices.map((device) => (
                  <TableRow key={device.id} className="hover:bg-slate-800/50">
                    <TableCell>
                      <a
                        href={`/devices/${device.id}`}
                        className="font-medium text-primary hover:text-primary-light transition-colors"
                      >
                        {device.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-slate-400">{device.model}</TableCell>
                    <TableCell>
                      <DeviceStatusBadge status={device.status} />
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {device.lastHeartbeat}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {device.battery !== "N/A" ? (
                        <span className={device.battery.startsWith("3") || device.battery.startsWith("2") ? "text-warning" : ""}>
                          {device.battery}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {device.signal}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No devices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Device Count */}
      <p className="text-sm text-slate-400">
        Showing {filteredDevices.length} of {devices.length} devices
      </p>
    </div>
  );
}
