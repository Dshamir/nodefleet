"use client";

import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  MapPin,
  FileText,
  HardDrive,
  Plus,
  Upload,
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeviceStatusBadge } from "@/components/dashboard/device-status-badge";

export default function DashboardPage() {
  // Mock data
  const stats = [
    {
      title: "Total Devices",
      value: "24",
      icon: Activity,
      trend: { value: 8, isPositive: true },
      color: "primary" as const,
    },
    {
      title: "Online Now",
      value: "18",
      icon: Activity,
      trend: { value: 2, isPositive: true },
      color: "success" as const,
    },
    {
      title: "Media Files",
      value: "1,234",
      icon: FileText,
      trend: { value: 45, isPositive: true },
      color: "warning" as const,
    },
    {
      title: "Storage Used",
      value: "45.2 GB",
      icon: HardDrive,
      trend: { value: 12, isPositive: false },
      color: "primary" as const,
    },
  ];

  const recentActivity = [
    {
      id: 1,
      device: "GPS Camera 01",
      action: "Captured photo",
      time: "2 minutes ago",
      status: "success" as const,
    },
    {
      id: 2,
      device: "Sensor Unit 15",
      action: "Telemetry update",
      time: "5 minutes ago",
      status: "success" as const,
    },
    {
      id: 3,
      device: "Audio Logger 08",
      action: "Recording completed",
      time: "12 minutes ago",
      status: "success" as const,
    },
    {
      id: 4,
      device: "Fleet Monitor 03",
      action: "GPS location update",
      time: "18 minutes ago",
      status: "success" as const,
    },
    {
      id: 5,
      device: "Mobile Unit 12",
      action: "Battery low warning",
      time: "25 minutes ago",
      status: "warning" as const,
    },
  ];

  const gpsPositions = [
    { device: "GPS Camera 01", lat: "37.7749", lng: "-122.4194", lastUpdate: "2 min ago" },
    { device: "Sensor Unit 15", lat: "34.0522", lng: "-118.2437", lastUpdate: "5 min ago" },
    { device: "Audio Logger 08", lat: "41.8781", lng: "-87.6298", lastUpdate: "12 min ago" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome back. Here's your fleet overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            trend={stat.trend}
            color={stat.color}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button className="bg-primary hover:bg-primary-dark justify-start gap-2">
              <Plus className="w-4 h-4" />
              Add Device
            </Button>
            <Button variant="outline" className="justify-start gap-2">
              <Upload className="w-4 h-4" />
              Upload Content
            </Button>
            <Button variant="outline" className="justify-start gap-2">
              <Clock className="w-4 h-4" />
              Create Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-800">
                    <div className="flex-1">
                      <p className="font-medium text-white">{activity.device}</p>
                      <p className="text-sm text-slate-400">{activity.action}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={activity.status === "success" ? "success" : "warning"} className="mb-1">
                        {activity.status === "success" ? "Success" : "Warning"}
                      </Badge>
                      <p className="text-xs text-slate-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GPS Positions */}
        <div>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Last GPS Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gpsPositions.map((pos) => (
                  <div key={pos.device} className="p-3 bg-slate-900/30 rounded-lg border border-slate-800">
                    <p className="text-sm font-medium text-white mb-2">{pos.device}</p>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>Lat: {pos.lat}</p>
                      <p>Lng: {pos.lng}</p>
                      <p className="text-primary pt-1">{pos.lastUpdate}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View Map
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
