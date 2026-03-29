"use client";

const COLOR_MAP: Record<string, string> = {
  // General
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  enabled: "bg-green-500/20 text-green-400 border-green-500/30",
  healthy: "bg-green-500/20 text-green-400 border-green-500/30",
  online: "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  delivered: "bg-green-500/20 text-green-400 border-green-500/30",
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  won: "bg-green-500/20 text-green-400 border-green-500/30",
  done: "bg-green-500/20 text-green-400 border-green-500/30",

  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  new: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  pairing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  open: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  overdue: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",

  processing: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  in_progress: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  qualified: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  review: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",

  shipped: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  in_transit: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  scheduled: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  proposal: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  negotiation: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",

  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  refunded: "bg-red-500/20 text-red-400 border-red-500/30",
  disabled: "bg-red-500/20 text-red-400 border-red-500/30",
  lost: "bg-red-500/20 text-red-400 border-red-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
  offline: "bg-red-500/20 text-red-400 border-red-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  down: "bg-red-500/20 text-red-400 border-red-500/30",

  degraded: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",

  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  archived: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  converted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",

  // Plans
  free: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  pro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  team: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",

  // Types
  email: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sms: "bg-green-500/20 text-green-400 border-green-500/30",
  push: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  percentage: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  fixed: "bg-green-500/20 text-green-400 border-green-500/30",
  free_shipping: "bg-blue-500/20 text-blue-400 border-blue-500/30",

  // Roles
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  owner: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  member: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  viewer: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  platform_admin: "bg-red-500/20 text-red-400 border-red-500/30",
};

const DEFAULT_COLOR = "bg-slate-500/20 text-slate-400 border-slate-500/30";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const color = COLOR_MAP[status] || DEFAULT_COLOR;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${color} ${className}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
