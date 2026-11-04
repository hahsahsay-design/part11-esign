"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  PenTool,
  ClipboardCheck,
  Settings,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/signatures", label: "Signature Requests", icon: PenTool },
  { href: "/compliance", label: "Compliance Center", icon: ClipboardCheck },
  { href: "/admin", label: "Administration", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function DashboardSidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <ShieldCheck className="h-5 w-5 text-sidebar-primary" />
        <span className="text-sm font-semibold">Part11 eSign</span>
      </div>
      <div className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">
        {orgName}
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/40">
        Not represented as FDA-validated. See Compliance Center for your validation evidence.
      </div>
    </aside>
  );
}
