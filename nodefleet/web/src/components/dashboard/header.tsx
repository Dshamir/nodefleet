"use client";

import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePathname } from "next/navigation";

const breadcrumbMap: Record<string, string[]> = {
  "/": ["Dashboard"],
  "/devices": ["Dashboard", "Devices"],
  "/devices/[id]": ["Dashboard", "Devices", "Device Details"],
  "/content": ["Dashboard", "Content Library"],
  "/schedules": ["Dashboard", "Schedules"],
  "/map": ["Dashboard", "Map"],
  "/settings": ["Dashboard", "Settings"],
  "/settings/billing": ["Dashboard", "Settings", "Billing"],
};

function getBreadcrumbs(pathname: string): string[] {
  const path = pathname.replace(/^\/dashboard\/?/, "") || "/";

  for (const [route, breadcrumbs] of Object.entries(breadcrumbMap)) {
    if (route === "/" && (pathname === "/" || pathname === "/dashboard")) {
      return breadcrumbs;
    }
    if (route !== "/" && pathname.startsWith(route.split("/[")[0])) {
      return breadcrumbs;
    }
  }

  return ["Dashboard"];
}

export function Header() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header role="banner" className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-30 lg:z-20">
      <div className="h-full px-6 flex items-center justify-between gap-4">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-400 hidden sm:flex">
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
              <span className={idx === breadcrumbs.length - 1 ? "text-white font-medium" : ""}>
                {crumb}
              </span>
            </div>
          ))}
        </nav>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search devices, content..."
            aria-label="Search"
            className="bg-slate-900/50 border-slate-800 text-white placeholder-slate-500 pl-10 focus-ring"
          />
        </div>
      </div>
    </header>
  );
}
