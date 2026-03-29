"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Activity,
  Shield,
  ToggleLeft,
  Cpu,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", href: "/platform-admin", icon: LayoutDashboard },
  { label: "Organizations", href: "/platform-admin/organizations", icon: Building2 },
  { label: "Users", href: "/platform-admin/users", icon: Users },
  { label: "Subscriptions", href: "/platform-admin/subscriptions", icon: CreditCard },
  { label: "Audit", href: "/platform-admin/audit", icon: Shield },
  { label: "Feature Flags", href: "/platform-admin/feature-flags", icon: ToggleLeft },
  { label: "System Health", href: "/platform-admin/health", icon: Activity },
];

interface AdminSidebarProps {
  user: {
    email?: string | null;
    name?: string | null;
  };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/platform-admin") return pathname === "/platform-admin";
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
      {/* Mobile Menu */}
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

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        role="navigation"
        className={`fixed left-0 top-0 h-screen w-64 bg-slate-950 border-r border-red-900/30 flex flex-col transition-transform duration-200 z-40 lg:z-0 lg:relative lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-red-900/30">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-lg">NodeFleet</span>
            <span className="block text-xs text-red-400 font-medium -mt-0.5">Platform Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Admin navigation" className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
                  active
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-red-900/30 p-4 space-y-3">
          <div className="px-3 py-2.5 bg-slate-900/50 rounded-lg">
            <p className="text-xs text-red-400/60 mb-0.5">Platform Admin</p>
            <p className="text-white text-sm font-medium truncate">
              {user.name || user.email || "Admin"}
            </p>
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
