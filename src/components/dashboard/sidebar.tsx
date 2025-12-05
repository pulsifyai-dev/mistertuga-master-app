"use client";

import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  ShoppingBag,
  AlertCircle,
  Settings,
} from "lucide-react";

const sidebarItems = [
  {
    label: "Profit Stats",
    href: "/profit-stats",
    icon: BarChart3,
  },
  {
    label: "Shopify Orders",
    href: "/master-shopify-orders",
    icon: ShoppingBag,
  },
  {
    label: "Mistake Handling",
    href: "/mistake-handling",
    icon: AlertCircle,
  },
];
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
            MT
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">MisterTuga</span>
            <span className="text-[11px] text-muted-foreground">
              Operations
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            const baseClasses =
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors";
            const activeClasses = isActive
              ? " bg-white text-black shadow-sm"
              : " text-muted-foreground hover:bg-white/5";

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  className={baseClasses + activeClasses}
                >
                  <a href={item.href}>
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 px-4 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-white/5"
            >
              <button type="button">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}