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
  ChevronDown,
  Lock,
  KeyRound,
  ShieldAlert,
  FileWarning,
  Gauge,
  Key,
  Newspaper,
  Fingerprint,
  MessageSquare,
  MessagesSquare,
  Brain,
  Bot,
  FileCode,
  Library,
  BarChart3,
  Globe,
  Target,
  ClipboardList,
  Megaphone,
  TrendingUp,
  Database,
  Network,
  Bell,
  Ticket,
  Wrench,
  GitBranch,
  BookOpen,
  Settings,
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

const PA = "/platform-admin";

const navGroups: NavGroup[] = [
  {
    label: "Platform",
    icon: LayoutDashboard,
    items: [
      { label: "Dashboard", href: PA, icon: LayoutDashboard },
      { label: "Organizations", href: `${PA}/organizations`, icon: Building2 },
      { label: "Users", href: `${PA}/users`, icon: Users },
      { label: "Subscriptions", href: `${PA}/subscriptions`, icon: CreditCard },
      { label: "System Health", href: `${PA}/health`, icon: Activity },
      { label: "Audit (Global)", href: `${PA}/audit`, icon: Shield },
    ],
  },
  {
    label: "Users & Auth",
    icon: Lock,
    items: [
      { label: "Access Control", href: `${PA}/access-control`, icon: KeyRound },
      { label: "Auth Settings", href: `${PA}/auth-settings`, icon: Lock },
      { label: "OTP Settings", href: `${PA}/otp-settings`, icon: Fingerprint },
    ],
  },
  {
    label: "Security",
    icon: ShieldAlert,
    items: [
      { label: "Fraud Detection", href: `${PA}/fraud-detection`, icon: ShieldAlert },
      { label: "Content Policy", href: `${PA}/content-policy`, icon: FileWarning },
      { label: "Rate Limits", href: `${PA}/rate-limits`, icon: Gauge },
      { label: "Credentials", href: `${PA}/credentials`, icon: Key },
    ],
  },
  {
    label: "Content",
    icon: Newspaper,
    items: [
      { label: "CMS / Content", href: `${PA}/cms`, icon: Newspaper },
      { label: "Messaging", href: `${PA}/messaging`, icon: MessageSquare },
      { label: "Chat", href: `${PA}/chat`, icon: MessagesSquare },
    ],
  },
  {
    label: "AI & Prompts",
    icon: Brain,
    items: [
      { label: "AI Settings", href: `${PA}/ai-settings`, icon: Brain },
      { label: "Custom Agents", href: `${PA}/agents`, icon: Bot },
      { label: "Prompt Templates", href: `${PA}/prompt-templates`, icon: FileCode },
    ],
  },
  {
    label: "Knowledge",
    icon: Library,
    items: [
      { label: "Knowledge Base", href: `${PA}/knowledge-base`, icon: Library },
    ],
  },
  {
    label: "Ranking",
    icon: TrendingUp,
    items: [
      { label: "Analytics", href: `${PA}/analytics`, icon: BarChart3 },
      { label: "SEO Settings", href: `${PA}/seo`, icon: Globe },
      { label: "Domains", href: `${PA}/domains`, icon: Globe },
      { label: "Leads", href: `${PA}/leads`, icon: Target },
      { label: "Lead Forms", href: `${PA}/lead-forms`, icon: ClipboardList },
      { label: "Campaigns", href: `${PA}/campaigns`, icon: Megaphone },
      { label: "Lead Scoring", href: `${PA}/lead-scoring`, icon: TrendingUp },
      { label: "CRM", href: `${PA}/crm`, icon: Users },
      { label: "Contacts", href: `${PA}/contacts`, icon: Users },
    ],
  },
  {
    label: "Operations",
    icon: Settings,
    items: [
      { label: "Database", href: `${PA}/database`, icon: Database },
      { label: "Feature Flags", href: `${PA}/feature-flags`, icon: ToggleLeft },
      { label: "Network", href: `${PA}/network`, icon: Network },
      { label: "Notifications", href: `${PA}/notifications-center`, icon: Bell },
    ],
  },
  {
    label: "Development",
    icon: GitBranch,
    items: [
      { label: "Dev Tickets", href: `${PA}/dev-tickets`, icon: Ticket },
      { label: "Repair Plans", href: `${PA}/repair-plans`, icon: Wrench },
      { label: "Version Control", href: `${PA}/version-control`, icon: GitBranch },
      { label: "Dev Wiki", href: `${PA}/dev-wiki`, icon: BookOpen },
    ],
  },
];

interface AdminSidebarProps {
  user: {
    email?: string | null;
    name?: string | null;
  };
}

function getStoredCollapsedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem("nf-admin-sidebar-collapsed");
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function storeCollapsedState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("nf-admin-sidebar-collapsed", JSON.stringify(state)); } catch {}
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { setCollapsed(getStoredCollapsedState()); }, []);

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      storeCollapsedState(next);
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === PA) return pathname === PA;
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup) => group.items.some((i) => isActive(i.href));

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
      <div className="lg:hidden fixed top-4 left-4 z-40">
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-white">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsOpen(false)} />}

      <aside
        role="navigation"
        className={`fixed left-0 top-0 h-screen w-64 bg-slate-950 border-r border-red-900/30 flex flex-col transition-transform duration-200 z-40 lg:z-0 lg:relative lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
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
        <nav aria-label="Admin navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isCollapsed = collapsed[group.label] ?? false;
            const groupActive = isGroupActive(group);

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${groupActive ? "text-red-400" : "text-slate-500 hover:text-slate-300"}`}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="w-3.5 h-3.5" />
                    {group.label}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>

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
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all ${active ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-slate-400 hover:text-white hover:bg-slate-900/50"}`}
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

        {/* User */}
        <div className="border-t border-red-900/30 p-4 space-y-3">
          <div className="px-3 py-2.5 bg-slate-900/50 rounded-lg">
            <p className="text-xs text-red-400/60 mb-0.5">Platform Admin</p>
            <p className="text-white text-sm font-medium truncate">{user.name || user.email || "Admin"}</p>
          </div>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-error justify-start text-sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}
