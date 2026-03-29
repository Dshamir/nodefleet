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
  ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "IoT",
    icon: Cpu,
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Devices", href: "/devices", icon: Cpu },
      { label: "Content Library", href: "/content", icon: FileText },
      { label: "Schedules", href: "/schedules", icon: Clock },
      { label: "Map", href: "/map", icon: Map },
    ],
  },
  {
    label: "Account",
    icon: Settings,
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Audit Trail", href: "/audit", icon: Shield },
    ],
  },
];

interface SidebarProps {
  user: {
    email?: string | null;
    name?: string | null;
    role?: string;
    orgId?: string;
  };
}

function getStoredCollapsedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem("nf-sidebar-collapsed");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function storeCollapsedState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("nf-sidebar-collapsed", JSON.stringify(state));
  } catch {}
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(getStoredCollapsedState());
  }, []);

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      storeCollapsedState(next);
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isActive(item.href));
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
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
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
        role="navigation"
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
        <nav
          aria-label="Main navigation"
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        >
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isCollapsed = collapsed[group.label] ?? false;
            const groupActive = isGroupActive(group);

            return (
              <div key={group.label}>
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                    groupActive
                      ? "text-primary"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="w-3.5 h-3.5" />
                    {group.label}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                {/* Group Items */}
                {!isCollapsed && (
                  <div className="ml-2 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                            active
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="border-t border-slate-800 p-4 space-y-3">
          <div className="px-3 py-2.5 bg-slate-900/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-0.5">Logged in as</p>
            <p className="text-white text-sm font-medium truncate">
              {user.name || user.email || "Unknown"}
            </p>
            {user.name && user.email && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>
          <Button
            variant="ghost"
            className="w-full text-slate-400 hover:text-error justify-start text-sm"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}
