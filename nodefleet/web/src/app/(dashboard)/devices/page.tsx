"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { NetworkScanner } from "@/components/dashboard/network-scanner";
import { Plus, Pencil, Trash2, Search, Loader2, Copy, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  name: string;
  hwModel: string;
  serialNumber: string;
  status: "online" | "offline" | "pairing" | "disabled";
  firmwareVersion: string | null;
  lastHeartbeatAt: string | null;
  lastIp: string | null;
  fleetId: string | null;
  pairingCode?: string;
}

interface Fleet {
  id: string;
  name: string;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DevicesPage() {
  // Data
  const [devices, setDevices] = useState<Device[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fleetFilter, setFleetFilter] = useState("all");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addModel, setAddModel] = useState("");
  const [addSerial, setAddSerial] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [createdPairingCode, setCreatedPairingCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ------ Fetch data ------

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/devices");
      if (!res.ok) throw new Error(`Failed to fetch devices (${res.status})`);
      const json = await res.json();
      setDevices(json.data || json.devices || []);
      setTotal(json.pagination?.total ?? json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFleets = useCallback(async () => {
    try {
      const res = await fetch("/api/fleets");
      if (!res.ok) return;
      const json = await res.json();
      setFleets(json.data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchFleets();
  }, [fetchDevices, fetchFleets]);

  // ------ Filtering ------

  const fleetMap = new Map(fleets.map((f) => [f.id, f.name]));

  const filteredDevices = devices.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.hwModel.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchFleet =
      fleetFilter === "all" ||
      (fleetFilter === "none" ? !d.fleetId : d.fleetId === fleetFilter);
    return matchSearch && matchStatus && matchFleet;
  });

  // ------ Add Device ------

  function resetAddForm() {
    setAddName("");
    setAddModel("");
    setAddSerial("");
    setAddError(null);
    setCreatedPairingCode(null);
    setCopiedCode(false);
  }

  async function handleAddDevice() {
    if (!addName.trim() || !addModel.trim() || !addSerial.trim()) {
      setAddError("All fields are required");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          hwModel: addModel.trim(),
          serialNumber: addSerial.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const created = await res.json();
      setCreatedPairingCode(created.pairingCode || null);
      await fetchDevices();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create device");
    } finally {
      setAddSaving(false);
    }
  }

  function handleCopyCode() {
    if (createdPairingCode) {
      navigator.clipboard.writeText(createdPairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  // ------ Edit Device ------

  function openEdit(device: Device) {
    setEditDevice(device);
    setEditName(device.name);
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEditDevice() {
    if (!editDevice || !editName.trim()) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/devices/${editDevice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      setEditOpen(false);
      await fetchDevices();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setEditSaving(false);
    }
  }

  // ------ Delete Device ------

  function openDelete(device: Device) {
    setDeleteDevice(device);
    setDeleteOpen(true);
  }

  async function handleDeleteDevice() {
    if (!deleteDevice) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/devices/${deleteDevice.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setDeleteOpen(false);
      setDeleteDevice(null);
      await fetchDevices();
    } catch {
      // keep dialog open on error
    } finally {
      setDeleting(false);
    }
  }

  // ------ Render ------

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Devices</h1>
          <p className="text-slate-400">Manage your IoT device fleet</p>
        </div>

        {/* Add Device Dialog */}
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetAddForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary-dark gap-2">
              <Plus className="w-5 h-5" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
              <DialogDescription>Register a new device to your fleet</DialogDescription>
            </DialogHeader>

            {createdPairingCode ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Device created. Flash this pairing code onto your ESP32 firmware, or call the pair API:
                </p>
                <code className="block text-xs text-slate-400 bg-slate-950 p-2 rounded mt-2 mb-2 break-all">
                  POST /api/devices/pair {`{"pairingCode": "${createdPairingCode}"}`}
                </code>
                <p className="text-xs text-slate-500">
                  The device will receive a JWT token valid for 365 days. Code expires in 24 hours.
                </p>
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                  <p className="text-sm text-slate-400 mb-2">Pairing Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-950 rounded border border-slate-700 text-white font-mono text-lg tracking-widest text-center">
                      {createdPairingCode}
                    </code>
                    <Button size="icon" variant="outline" onClick={handleCopyCode}>
                      {copiedCode ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setAddOpen(false);
                    resetAddForm();
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Device Name
                  </label>
                  <Input
                    placeholder="e.g. GPS Camera 01"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Hardware Model
                  </label>
                  <Input
                    placeholder="e.g. ESP32-CAM"
                    value={addModel}
                    onChange={(e) => setAddModel(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Serial Number
                  </label>
                  <Input
                    placeholder="e.g. SN-2024-00001"
                    value={addSerial}
                    onChange={(e) => setAddSerial(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                {addError && (
                  <p className="text-sm text-red-400">{addError}</p>
                )}
                <Button
                  className="w-full bg-primary hover:bg-primary-dark gap-2"
                  onClick={handleAddDevice}
                  disabled={addSaving}
                >
                  {addSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Device
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by name or model..."
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
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="pairing">Pairing</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fleetFilter} onValueChange={setFleetFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fleets</SelectItem>
                <SelectItem value="none">No Fleet</SelectItem>
                {fleets.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      {/* Network Discovery Scanner */}
      <NetworkScanner />

      {/* Devices Table */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Fleet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Heartbeat</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading devices...
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-red-400">
                    {error}
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length > 0 ? (
                filteredDevices.map((device) => (
                  <TableRow key={device.id} className="hover:bg-slate-800/50">
                    <TableCell>
                      <Link
                        href={`/devices/${device.id}`}
                        className="font-medium text-primary hover:text-primary-light transition-colors"
                      >
                        {device.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs sm:text-sm">{device.hwModel}</TableCell>
                    <TableCell className="text-slate-400 text-xs sm:text-sm">
                      {device.fleetId ? fleetMap.get(device.fleetId) || "Unknown" : "--"}
                    </TableCell>
                    <TableCell>
                      <DeviceStatusBadge status={device.status} />
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs sm:text-sm">
                      {formatRelativeTime(device.lastHeartbeatAt)}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs sm:text-sm font-mono">
                      {device.serialNumber}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => openEdit(device)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                          onClick={() => openDelete(device)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    <p>No devices found</p>
                    <button
                      onClick={() => setAddOpen(true)}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add your first device
                    </button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Footer count */}
      <p className="text-sm text-slate-400">
        Showing {filteredDevices.length} of {total} devices
      </p>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device information for{" "}
              <span className="text-white">{editDevice?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Device Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>

            {/* Pairing code info + regenerate */}
            {editDevice && (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Pairing Code</p>
                    <p className="font-mono text-white">{editDevice.pairingCode || "—"}</p>
                    <p className="text-xs text-slate-500">
                      {editDevice.status === "pairing" ? "Waiting for device to pair" : `Status: ${editDevice.status}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={async () => {
                      setEditSaving(true);
                      try {
                        const res = await fetch(`/api/devices/${editDevice.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ regeneratePairingCode: true }),
                        });
                        if (res.ok) {
                          const updated = await res.json();
                          setEditDevice({ ...editDevice, pairingCode: updated.pairingCode, status: updated.status });
                          await fetchDevices();
                        }
                      } catch {}
                      finally { setEditSaving(false); }
                    }}
                    disabled={editSaving}
                  >
                    {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    New Code
                  </Button>
                </div>
              </div>
            )}

            {editError && <p className="text-sm text-red-400">{editError}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary-dark gap-2"
                onClick={handleEditDevice}
                disabled={editSaving}
              >
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">{deleteDevice?.name}</span>? This
              will permanently remove the device and all associated telemetry, GPS, and
              command data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={handleDeleteDevice}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Device
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
