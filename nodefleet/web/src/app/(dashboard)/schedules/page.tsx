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
import { Plus, Edit, Trash2, Clock, Loader2 } from "lucide-react";

interface ScheduleAssignment {
  deviceId: string;
}

interface Schedule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  cronExpression: string;
  repeatType: string;
  createdAt: string;
  items: any[];
  assignments: ScheduleAssignment[];
}

export default function SchedulesPage() {
  const [newScheduleOpen, setNewScheduleOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [repeatType, setRepeatType] = useState("daily");
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchedules() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/schedules");
        if (!res.ok) throw new Error("Failed to fetch schedules");
        const data = await res.json();
        setSchedules(data.data || data);
      } catch (err: any) {
        setError(err.message || "Failed to load schedules");
      } finally {
        setLoading(false);
      }
    }
    fetchSchedules();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Schedules</h1>
          <p className="text-slate-400">Automate tasks across your device fleet</p>
        </div>
        <Dialog open={newScheduleOpen} onOpenChange={setNewScheduleOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary-dark gap-2">
              <Plus className="w-5 h-5" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Schedule</DialogTitle>
              <DialogDescription>
                Set up an automated task to run across your devices
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Schedule Name
                </label>
                <Input
                  placeholder="e.g. Daily Photo Capture"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Repeat Type
                </label>
                <Select value={repeatType} onValueChange={setRepeatType}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Run Once</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom (Cron)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Cron Expression
                </label>
                <Input
                  placeholder="0 9 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className="bg-slate-800 border-slate-700 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Format: minute hour day month dayOfWeek
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Start Date
                </label>
                <Input
                  type="date"
                  className="bg-slate-800 border-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  End Date (Optional)
                </label>
                <Input
                  type="date"
                  className="bg-slate-800 border-slate-700"
                />
              </div>

              <Button className="w-full bg-primary hover:bg-primary-dark">
                Create Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-400">Loading schedules...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && schedules.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-12 pb-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">No schedules found</p>
            <p className="text-slate-500 text-sm mt-1">
              Create a schedule to automate tasks across your devices
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedules Table */}
      {!loading && !error && schedules.length > 0 && (
        <>
          <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Repeat Type</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Cron Expression</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id} className="hover:bg-slate-800/50">
                      <TableCell className="font-medium text-white">
                        {schedule.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={schedule.isActive ? "success" : "secondary"}
                        >
                          {schedule.isActive ? "active" : "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {schedule.repeatType}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {schedule.assignments?.length ?? 0} devices
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs font-mono">
                        {schedule.cronExpression}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost">
                            <Edit className="w-4 h-4 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="w-4 h-4 text-error" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Schedule Details Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{schedule.name}</CardTitle>
                      <Badge
                        variant={schedule.isActive ? "success" : "secondary"}
                        className="mt-2"
                      >
                        {schedule.isActive ? "active" : "inactive"}
                      </Badge>
                    </div>
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {schedule.description && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Description</p>
                      <p className="text-sm text-slate-300">{schedule.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Repeat</p>
                    <p className="text-sm text-white font-medium">{schedule.repeatType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Cron Expression</p>
                    <p className="text-xs text-slate-300 font-mono">{schedule.cronExpression}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Assigned Devices</p>
                    <p className="text-sm text-white font-medium">
                      {schedule.assignments?.length ?? 0} devices
                    </p>
                  </div>
                  <Button variant="outline" className="w-full">
                    View Tasks
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
