"use client";

import * as React from "react";
import {
  Activity,
  LayoutDashboard,
  Settings,
  Users,
  Building2,
  LogOut,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const [platformName, setPlatformName] = React.useState("EMS Portal");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/platform-exists")
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setPlatformName(data.name);
        if (data.logoURL) setLogoUrl(data.logoURL);
      })
      .catch(console.error);
  }, []);

  const role = session?.user?.role || "USER";

  // Define nav items based on role
  const getNavItems = () => {
    const items = [
      {
        title: "Dashboard",
        url: `/${role.toLowerCase().replace("_", "-")}/dashboard`,
        icon: LayoutDashboard,
      },
    ];

    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      items.push({
        title: "Users",
        url: `/${role.toLowerCase().replace("_", "-")}/users`,
        icon: Users,
      });
    }

    if (role === "SUPER_ADMIN") {
      items.push({
        title: "Organizations",
        url: "/super-admin/organizations",
        icon: Building2,
      });
      items.push({
        title: "System Logs",
        url: "/super-admin/logs",
        icon: Activity,
      });
    }

    items.push({
      title: "Settings",
      url: `/${role.toLowerCase().replace("_", "-")}/settings`,
      icon: Settings,
    });

    return items;
  };

  const navItems = getNavItems();

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r border-indigo-100 bg-indigo-50/40" {...props}>
      <SidebarHeader className="h-16 flex items-center justify-start px-4 group-data-[collapsible=icon]:px-2 border-b border-indigo-100 transition-all">
        <div className="flex items-center gap-3 font-semibold text-indigo-900 w-full px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
          </div>
          <span className="truncate text-base tracking-tight group-data-[collapsible=icon]:hidden">{platformName}</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  render={<a href={item.url} />}
                  isActive={isActive}
                  tooltip={item.title}
                  className={`mb-1.5 px-3 py-5 rounded-xl transition-all ${
                    isActive 
                      ? "!bg-indigo-600 !text-white hover:!bg-indigo-700 hover:!text-white shadow-md shadow-indigo-200/50" 
                      : "text-slate-600 hover:bg-indigo-100/50 hover:text-indigo-900"
                  }`}
                >
                  <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-indigo-100" : "text-indigo-400"}`} />
                  <span className="font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-indigo-100">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => signOut({ callbackUrl: "/login" })}
              tooltip="Logout"
              className="w-full px-3 py-5 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0 text-red-400" />
              <span className="font-medium group-data-[collapsible=icon]:hidden">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
