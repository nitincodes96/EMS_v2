"use client";

import * as React from "react";
import {
  Activity,
  Building2,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Watch,
  Calendar
} from "lucide-react";
import Link from "next/link";
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
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV_ITEMS = {
  SUPER_ADMIN: [
    {
      title: "Dashboard",
      url: "/super-admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Organizations",
      url: "/super-admin/organizations",
      icon: Building2,
    },
    {
      title: "Users",
      url: "/super-admin/users",
      icon: Users,
    },
    {
      title: "Attendance",
      url: "/super-admin/attendance",
      icon: Watch,
    },
    {
      title: "Leave",
      url: "/super-admin/leave",
      icon: Calendar,
    },
    {
      title: "System Logs",
      url: "/super-admin/logs",
      icon: Activity,
    },
    {
      title: "Settings",
      url: "/super-admin/settings",
      icon: Settings,
    },
  ],

  ADMIN: [
    {
      title: "Dashboard",
      url: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Users",
      url: "/admin/users",
      icon: Users,
    },
    {
      title: "Attendance",
      url: "/admin/attendance",
      icon: Watch,
    },
    {
      title: "Leave",
      url: "/admin/leave",
      icon: Calendar,
    },
    {
      title: "System Logs",
      url: "/admin/logs",
      icon: Activity,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings,
    },
  ],

  USER: [
    {
      title: "Dashboard",
      url: "/user/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Attendance",
      url: "/user/attendance",
      icon: Watch,
    },
    {
      title: "Leave",
      url: "/user/leave",
      icon: Calendar,
    },
    {
      title: "Settings",
      url: "/user/settings",
      icon: Settings,
    },
  ],
} as const;

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [platformName, setPlatformName] = React.useState("EMS Portal");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchPlatform = async () => {
      try {
        const res = await fetch("/api/platform-exists");
        const data = await res.json();

        if (data.name) {
          setPlatformName(data.name);
          document.title = data.name;
        }

        if (data.logoURL) {
          setLogoUrl(data.logoURL);

          let favicon = document.querySelector(
            "link[rel*='icon']"
          ) as HTMLLinkElement | null;

          if (!favicon) {
            favicon = document.createElement("link");
            favicon.rel = "icon";
            document.head.appendChild(favicon);
          }

          favicon.href = data.logoURL;
        }
      } catch (error) {
        console.error("Failed to fetch platform settings:", error);
      }
    };

    fetchPlatform();
  }, []);

  const role = (session?.user?.role || "USER") as keyof typeof NAV_ITEMS;

  const navItems = NAV_ITEMS[role] ?? NAV_ITEMS.USER;

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-r border-indigo-100 bg-indigo-50/40"
      {...props}
    >
      <SidebarHeader className="h-16 flex items-center border-b border-indigo-100 px-4 transition-all group-data-[collapsible=icon]:px-2">
        <div className="flex w-full items-center gap-3 px-2 font-semibold text-indigo-900 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Platform Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <Activity className="h-4 w-4" />
            )}
          </div>

          <span className="truncate text-base tracking-tight group-data-[collapsible=icon]:hidden">
            {platformName}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarMenu>
          {status === "loading" ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            </>
          ) : (
            navItems.map((item) => {
              const isActive =
                pathname === item.url ||
                pathname.startsWith(item.url + "/");

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    tooltip={item.title}
                    isActive={isActive}
                    className={`mb-1.5 rounded-xl px-3 py-5 transition-all ${isActive
                      ? "!bg-indigo-600 !text-white shadow-md shadow-indigo-200/50 hover:!bg-indigo-700"
                      : "text-slate-600 hover:bg-indigo-100/50 hover:text-indigo-900"
                      }`}
                  >
                    <item.icon
                      className={`h-5 w-5 shrink-0 ${isActive
                        ? "text-indigo-100"
                        : "text-indigo-400"
                        }`}
                    />

                    <span className="font-medium group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-indigo-100 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full rounded-xl px-3 py-5 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-5 w-5 shrink-0 text-red-400" />

              <span className="font-medium group-data-[collapsible=icon]:hidden">
                Logout
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}