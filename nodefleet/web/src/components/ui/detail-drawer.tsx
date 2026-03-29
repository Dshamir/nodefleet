"use client";

import { X } from "lucide-react";
import { Button } from "./button";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}

export function DetailDrawer({ open, onClose, title, subtitle, children, width = "max-w-xl" }: DetailDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className={`absolute right-0 top-0 h-full ${width} w-full bg-slate-950 border-l border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-slide-in-left`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

interface DrawerTabsProps {
  tabs: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  active: string;
  onChange: (id: string) => void;
}

export function DrawerTabs({ tabs, active, onChange }: DrawerTabsProps) {
  return (
    <div className="flex border-b border-slate-800 px-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            active === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
