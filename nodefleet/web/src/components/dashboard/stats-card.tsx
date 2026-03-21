"use client";

import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "primary" | "success" | "warning" | "error";
}

const colorConfig = {
  primary: "from-primary/20 to-primary/10 border-primary/30",
  success: "from-success/20 to-success/10 border-success/30",
  warning: "from-warning/20 to-warning/10 border-warning/30",
  error: "from-error/20 to-error/10 border-error/30",
};

const iconColorConfig = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "primary",
}: StatsCardProps) {
  return (
    <div
      className={`p-6 rounded-lg border bg-gradient-to-br ${colorConfig[color]} backdrop-blur-sm hover:border-opacity-100 transition-all`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`p-3 rounded-lg bg-slate-900/50 ${iconColorConfig[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {trend && (
        <div className={`text-sm font-medium ${trend.isPositive ? "text-success" : "text-error"}`}>
          {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last month
        </div>
      )}
    </div>
  );
}
