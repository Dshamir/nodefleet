"use client";

import { Badge } from "@/components/ui/badge";

type DeviceStatus = "online" | "offline" | "pairing" | "disabled";

const statusConfig: Record<
  DeviceStatus,
  { label: string; className: string; dotColor: string }
> = {
  online: {
    label: "Online",
    className: "bg-success/20 text-success border-success/30",
    dotColor: "bg-success",
  },
  offline: {
    label: "Offline",
    className: "bg-slate-700/20 text-slate-400 border-slate-700/30",
    dotColor: "bg-slate-600",
  },
  pairing: {
    label: "Pairing",
    className: "bg-warning/20 text-warning border-warning/30",
    dotColor: "bg-warning animate-pulse",
  },
  disabled: {
    label: "Disabled",
    className: "bg-error/20 text-error border-error/30",
    dotColor: "bg-error",
  },
};

interface DeviceStatusBadgeProps {
  status: DeviceStatus;
  showDot?: boolean;
  compact?: boolean;
}

export function DeviceStatusBadge({
  status,
  showDot = true,
  compact = false,
}: DeviceStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge className={`gap-2 border ${config.className} ${compact ? "text-xs" : ""}`}>
      {showDot && <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />}
      {config.label}
    </Badge>
  );
}
