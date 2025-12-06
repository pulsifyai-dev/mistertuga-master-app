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
  LogOut,
} from "lucide-react";

import { useAuth } from '@/hooks/use-auth'; 

const ALL_SIDEBAR_ITEMS = [
  {
    label: "Profit Stats",
    href: "/profit-stats",
    icon: BarChart3,
    requiresAdmin: true,
  },
  {
    label: "Shopify Orders",
    href: "/master-shopify-orders",
    icon: ShoppingBag,
    requiresAdmin: false,
  },
  {
    label: "Mistake Handling",
    href: "/mistake-handling",
    icon: AlertCircle,
    requiresAdmin: false,
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  // Obtemos setOpen para controlar o estado da sidebar
  const { isMobile, setOpen } = useSidebar();
  const { signOut, isAdmin, user, role } = useAuth(); 

  const isSettingsActive = pathname === "/settings";

  const baseButtonClasses =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors";
  const activeButtonClasses =
    "bg-neutral-900/80 text-white border border-white/15 shadow-sm";
  const inactiveButtonClasses =
    "text-muted-foreground hover:bg-white/5";

  const logoutButtonClasses =
    "text-red-400 hover:bg-red-500/10 hover:text-red-400";

  // 💡 CORREÇÃO 1: Fecha a sidebar ao navegar, independentemente do dispositivo.
  const handleNavClick = () => {
    setOpen(false);
  };

  // 💡 CORREÇÃO 2: Fecha a sidebar após o logout.
  const handleLogout = () => {
    signOut();
    setOpen(false);
  };
  
  const filteredSidebarItems = ALL_SIDEBAR_ITEMS.filter(item => {
    if (item.requiresAdmin && !isAdmin) {
      return false;
    }
    return true;
  });

  return (
    <>
      <SidebarHeader className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
            {user?.displayName ? user.displayName[0].toUpperCase() : 'MT'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{user?.displayName || 'Usuário'}</span>
            <span className="text-[11px] text-muted-foreground">
              {role ? `${role} Access` : user?.email || 'Operations'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-3">
        <SidebarMenu>
          {filteredSidebarItems.map((item) => { 
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

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className={baseButtonClasses + " " + logoutButtonClasses}
            >
              <LogOut className="h-4 w-4" />
              <span>Sair / Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}