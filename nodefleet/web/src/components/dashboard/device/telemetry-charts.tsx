"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TelemetryRecord {
  id: string;
  timestamp: string;
  batteryLevel: number | null;
  signalStrength: number | null;
  cpuTemp: number | null;
  freeMemory: number | null;
  uptimeSeconds: number | null;
}

interface Props {
  deviceId: string;
}

const RANGES = [
  { label: "1H", value: "1h" },
  { label: "6H", value: "6h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
];

export function TelemetryCharts({ deviceId }: Props) {
  const [range, setRange] = useState("24h");
  const [data, setData] = useState<TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/telemetry?range=${r}&limit=500`);
      if (res.ok) {
        const json = await res.json();
        setData((json.data || []).reverse()); // Oldest first for charts
      }
    } catch (err) {
      console.error("Failed to fetch telemetry:", err);
    }
    setLoading(false);
  };

  // Fetch on mount and range change
  useState(() => { fetchData(range); });

  const handleRangeChange = (r: string) => {
    setRange(r);
    fetchData(r);
  };

  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    battery: d.batteryLevel,
    signal: d.signalStrength,
    cpuTemp: d.cpuTemp,
    freeMemory: d.freeMemory ? Math.round(d.freeMemory / 1024) : null, // KB
    uptime: d.uptimeSeconds ? Math.round(d.uptimeSeconds / 60) : null, // minutes
  }));

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            size="sm"
            variant={range === r.value ? "default" : "outline"}
            onClick={() => handleRangeChange(r.value)}
            disabled={loading}
          >
            {r.label}
          </Button>
        ))}
        {loading && <span className="text-sm text-slate-400 ml-2">Loading...</span>}
        <span className="text-sm text-slate-500 ml-auto">{data.length} records</span>
      </div>

      {data.length === 0 && !loading && (
        <p className="text-slate-500 text-center py-8">No telemetry data for this range</p>
      )}

      {data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CPU Temperature */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">CPU Temperature</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} unit="C" />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "70C", fill: "#ef4444", fontSize: 10 }} />
                  <Line type="monotone" dataKey="cpuTemp" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Signal Strength */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Signal Strength (dBm)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} unit="dBm" />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <ReferenceLine y={-100} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Weak", fill: "#ef4444", fontSize: 10 }} />
                  <Area type="monotone" dataKey="signal" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Free Memory */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Free Memory (KB)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} unit="KB" />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="freeMemory" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Battery */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Battery Level</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Low", fill: "#ef4444", fontSize: 10 }} />
                  <Line type="monotone" dataKey="battery" stroke="#eab308" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
