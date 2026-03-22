"use client";

import { useState, useEffect } from "react";
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

interface Device {
  id: string;
  name: string;
  hwModel: string;
  serialNumber: string;
  status: "online" | "offline" | "pairing" | "disabled";
  firmwareVersion: string;
  lastHeartbeatAt: string | null;
  lastIp: string;
}

interface DevicesResponse {
  devices: Device[];
  total: number;
  page: number;
  limit: number;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "N/A";

  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return "N/A";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return seconds <= 1 ? "just now" : `${seconds} sec ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export default function DevicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const pairingCode = "DEV-2024-ABC123XYZ";

  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDevices() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/devices");
        if (!res.ok) {
          throw new Error(`Failed to fetch devices (${res.status})`);
        }
        const data: DevicesResponse = await res.json();
        setDevices(data.data || data.devices || []);
        setTotal(data.pagination?.total ?? data.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch devices");
      } finally {
        setLoading(false);
      }
    }

    fetchDevices();
  }, []);

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(search.toLowerCase()) ||
      device.hwModel.toLowerCase().includes(search.toLowerCase());

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
                <TableHead>Serial Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-500 border-t-primary rounded-full animate-spin" />
                      Loading devices...
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-red-400">
                    {error}
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length > 0 ? (
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
                    <TableCell className="text-slate-400">{device.hwModel}</TableCell>
                    <TableCell>
                      <DeviceStatusBadge status={device.status} />
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {formatRelativeTime(device.lastHeartbeatAt)}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm font-mono">
                      {device.serialNumber}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
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
        Showing {filteredDevices.length} of {total} devices
      </p>
    </div>
  );
}
