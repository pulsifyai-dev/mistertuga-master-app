"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  ShoppingBag,
  AlertCircle,
  Settings,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpen } = useSidebar();   // ⬅️ usar isMobile

  const isSettingsActive = pathname === "/settings";

  const baseButtonClasses =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors";
  const activeButtonClasses =
    "bg-neutral-900/80 text-white border border-white/15 shadow-sm";
  const inactiveButtonClasses =
    "text-muted-foreground hover:bg-white/5";

  // Fecha a sidebar apenas em mobile
  const handleNavClick = () => {
    if (isMobile) {
      setOpen(false);
    }
  };

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

      <SidebarContent className="px-4 py-3">
        <SidebarMenu>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  className={
                    baseButtonClasses +
                    " " +
                    (isActive ? activeButtonClasses : inactiveButtonClasses)
                  }
                >
                  <Link href={item.href} onClick={handleNavClick}>
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </Link>
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
              className={
                baseButtonClasses +
                " " +
                (isSettingsActive ? activeButtonClasses : inactiveButtonClasses)
              }
            >
              <Link href="/settings" onClick={handleNavClick}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}