"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  FileText,
  Clock,
  Map,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Overview", href: "/devices", icon: LayoutDashboard },
  { label: "Devices", href: "/devices", icon: Cpu },
  { label: "Content Library", href: "/content", icon: FileText },
  { label: "Schedules", href: "/schedules", icon: Clock },
  { label: "Map", href: "/map", icon: Map },
  { label: "Audit Trail", href: "/audit", icon: Shield },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  user: {
    email?: string | null;
    name?: string | null;
    role?: string;
    orgId?: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    try {
      const res = await fetch("/api/auth/csrf");
      const { csrfToken } = await res.json();
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken }),
      });
    } catch {}
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-400 hover:text-white"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </Button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-200 z-40 lg:z-0 lg:relative lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg">NodeFleet</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="border-t border-slate-800 p-4 space-y-3">
          <div className="px-4 py-3 bg-slate-900/50 rounded-lg">
            <p className="text-sm text-slate-400 mb-1">Logged in as</p>
            <p className="text-white font-medium truncate">
              {user.name || user.email || "Unknown"}
            </p>
            {user.name && user.email && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>
          <Button
            variant="ghost"
            className="w-full text-slate-400 hover:text-error justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}
