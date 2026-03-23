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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Plus, Pencil, Trash2, Loader2, AlertCircle, HelpCircle } from "lucide-react";

interface Schedule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  cronExpression: string | null;
  repeatType: string;
  conditions: Record<string, number> | null;
  assignments?: { deviceId: string }[];
  items?: { command: string; commandPayload: unknown }[];
}

interface Device {
  id: string;
  name: string;
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRepeat, setEditRepeat] = useState("daily");
  const [editCron, setEditCron] = useState("");
  const [editCommand, setEditCommand] = useState("capture_photo");
  const [editDevices, setEditDevices] = useState<string[]>([]);
  const [editCondBattery, setEditCondBattery] = useState("");
  const [editCondTemp, setEditCondTemp] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repeatType, setRepeatType] = useState("daily");
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [command, setCommand] = useState("capture_photo");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [condBatteryBelow, setCondBatteryBelow] = useState("");
  const [condTempAbove, setCondTempAbove] = useState("");

  useEffect(() => {
    fetchSchedules();
    fetchDevices();
  }, []);

  async function fetchSchedules() {
    try {
      const res = await fetch("/api/schedules");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSchedules(data.data || data);
    } catch {
      setError("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDevices() {
    try {
      const res = await fetch("/api/devices?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      setDevices((data.data || data.devices || []).map((d: Device) => ({ id: d.id, name: d.name })));
    } catch {}
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const conditions: Record<string, number> = {};
      if (condBatteryBelow) conditions.batteryBelow = Number(condBatteryBelow);
      if (condTempAbove) conditions.tempAbove = Number(condTempAbove);

      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          repeatType,
          cronExpression,
          conditions: Object.keys(conditions).length > 0 ? conditions : null,
          items: [{ command, commandPayload: {}, orderIndex: 1 }],
          deviceIds: selectedDevices,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setCreateOpen(false);
      resetForm();
      fetchSchedules();
    } catch {
      setError("Failed to create schedule");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      setDeleteId(null);
      fetchSchedules();
    } catch {
      setError("Failed to delete schedule");
    }
  }

  async function handleToggle(schedule: Schedule) {
    try {
      await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      });
      fetchSchedules();
    } catch {}
  }

  function resetForm() {
    setName("");
    setDescription("");
    setRepeatType("daily");
    setCronExpression("0 9 * * *");
    setCommand("capture_photo");
    setSelectedDevices([]);
    setCondBatteryBelow("");
    setCondTempAbove("");
  }

  function toggleDevice(id: string) {
    setSelectedDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  const cronPresets = [
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every day at 9am", value: "0 9 * * *" },
    { label: "Every day at 6pm", value: "0 18 * * *" },
    { label: "Every Mon 8am", value: "0 8 * * 1" },
    { label: "Every Wed 8am", value: "0 8 * * 3" },
    { label: "1st of month 2am", value: "0 2 1 * *" },
    { label: "Every 15 min", value: "*/15 * * * *" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
  ];

  function openEdit(s: Schedule) {
    setEditSchedule(s);
    setEditName(s.name);
    setEditDesc(s.description || "");
    setEditRepeat(s.repeatType);
    setEditCron(s.cronExpression || "");
    setEditCommand(s.items?.[0]?.command || "capture_photo");
    setEditDevices(s.assignments?.map(a => a.deviceId) || []);
    setEditCondBattery(s.conditions?.batteryBelow?.toString() || "");
    setEditCondTemp(s.conditions?.tempAbove?.toString() || "");
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editSchedule || !editName.trim()) return;
    setEditSaving(true);
    try {
      const conditions: Record<string, number> = {};
      if (editCondBattery) conditions.batteryBelow = Number(editCondBattery);
      if (editCondTemp) conditions.tempAbove = Number(editCondTemp);

      await fetch(`/api/schedules/${editSchedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDesc || null,
          repeatType: editRepeat,
          cronExpression: editCron || null,
          conditions: Object.keys(conditions).length > 0 ? conditions : null,
          items: [{ command: editCommand, commandPayload: {}, orderIndex: 1 }],
          deviceIds: editDevices,
        }),
      });
      setEditOpen(false);
      fetchSchedules();
    } catch { setError("Failed to update schedule"); }
    finally { setEditSaving(false); }
  }

  function toggleEditDevice(id: string) {
    setEditDevices(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Schedules</h1>
          <p className="text-slate-400">Automate device tasks with conditions</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary-dark">
              <Plus className="w-4 h-4 mr-2" /> Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">Create Schedule</DialogTitle>
              <DialogDescription className="text-slate-400">
                Define what command to run, when, and under what conditions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-slate-300">Schedule Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Daily Photo Capture" />
              </div>
              <div>
                <label className="text-sm text-slate-300">Description</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-300">Repeat Type</label>
                  <Select value={repeatType} onValueChange={setRepeatType}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="once">Once</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="cron">Custom Cron</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-300">Cron Expression</label>
                  <Input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white mt-1 font-mono" placeholder="0 9 * * *" />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cronPresets.map((p) => (
                      <button key={p.value} type="button" onClick={() => setCronExpression(p.value)}
                        className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700">
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Format: minute hour day month weekday</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-300">Command</label>
                <Select value={command} onValueChange={setCommand}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="capture_photo">Capture Photo</SelectItem>
                    <SelectItem value="capture_video">Capture Video</SelectItem>
                    <SelectItem value="record_audio">Record Audio</SelectItem>
                    <SelectItem value="reboot">Reboot</SelectItem>
                    <SelectItem value="update_firmware">Update Firmware</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditions */}
              <div>
                <label className="text-sm text-slate-300 font-medium">Conditions (optional)</label>
                <p className="text-xs text-slate-500 mb-2">Task only runs when conditions are met</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Battery below (%)</label>
                    <Input type="number" value={condBatteryBelow} onChange={(e) => setCondBatteryBelow(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="e.g. 20" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Temp above (C)</label>
                    <Input type="number" value={condTempAbove} onChange={(e) => setCondTempAbove(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="e.g. 60" />
                  </div>
                </div>
              </div>

              {/* Device Assignment */}
              <div>
                <label className="text-sm text-slate-300 font-medium">Assign Devices</label>
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {devices.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded">
                      <input type="checkbox" checked={selectedDevices.includes(d.id)} onChange={() => toggleDevice(d.id)}
                        className="rounded border-slate-600" />
                      {d.name}
                    </label>
                  ))}
                  {devices.length === 0 && <p className="text-xs text-slate-500">No devices available</p>}
                </div>
              </div>

              <Button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full bg-primary hover:bg-primary-dark">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Schedules Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            All Schedules
            <span className="text-sm font-normal text-slate-400 ml-2">{schedules.length} total</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No schedules yet. Create one to automate device tasks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Repeat</TableHead>
                    <TableHead>Cron</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id} className="hover:bg-slate-800/50">
                      <TableCell>
                        <div>
                          <p className="text-white font-medium">{s.name}</p>
                          {s.description && <p className="text-xs text-slate-500">{s.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`cursor-pointer ${s.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                          onClick={() => handleToggle(s)}
                        >
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 capitalize">{s.repeatType}</TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs">{s.cronExpression || "-"}</TableCell>
                      <TableCell className="text-slate-400">{s.assignments?.length || 0} devices</TableCell>
                      <TableCell>
                        {s.conditions ? (
                          <div className="text-xs space-y-0.5">
                            {Object.entries(s.conditions).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="border-slate-700 text-slate-300 text-xs mr-1">
                                {k}: {String(v)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white"
                            onClick={() => openEdit(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setDeleteId(s.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Schedule Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Schedule</DialogTitle>
            <DialogDescription className="text-slate-400">Update schedule configuration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-slate-300">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1" />
            </div>
            <div>
              <label className="text-sm text-slate-300">Description</label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300">Repeat Type</label>
                <Select value={editRepeat} onValueChange={setEditRepeat}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="cron">Custom Cron</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-slate-300">Cron Expression</label>
                <Input value={editCron} onChange={(e) => setEditCron(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1 font-mono" />
                <div className="flex flex-wrap gap-1 mt-1">
                  {cronPresets.map((p) => (
                    <button key={p.value} type="button" onClick={() => setEditCron(p.value)}
                      className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-300">Command</label>
              <Select value={editCommand} onValueChange={setEditCommand}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="capture_photo">Capture Photo</SelectItem>
                  <SelectItem value="capture_video">Capture Video</SelectItem>
                  <SelectItem value="record_audio">Record Audio</SelectItem>
                  <SelectItem value="reboot">Reboot</SelectItem>
                  <SelectItem value="update_firmware">Update Firmware</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Battery below (%)</label>
                <Input type="number" value={editCondBattery} onChange={(e) => setEditCondBattery(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Temp above (C)</label>
                <Input type="number" value={editCondTemp} onChange={(e) => setEditCondTemp(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-300 font-medium">Assign Devices</label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {devices.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded">
                    <input type="checkbox" checked={editDevices.includes(d.id)} onChange={() => toggleEditDevice(d.id)} className="rounded border-slate-600" />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary-dark gap-2" onClick={handleEdit} disabled={editSaving}>
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Schedule?</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will permanently delete the schedule and all its assignments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
            <Button onClick={() => deleteId && handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
