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

import { EntityAvatar } from "@/components/shared/entity-avatar";

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

  const [brandName, setBrandName] = React.useState("EMS Portal");
  const [brandDescription, setBrandDescription] = React.useState<string | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    const applyBrand = (payload: {
      name?: string | null;
      description?: string | null;
      logoUrl?: string | null;
      logoURL?: string | null;
    }) => {
      if (!active) {
        return;
      }

      const nextName = payload.name?.trim() || "EMS Portal";
      const nextDescription = payload.description?.trim() || null;
      const nextLogoUrl = payload.logoUrl ?? payload.logoURL ?? null;

      setBrandName(nextName);
      setBrandDescription(nextDescription);
      setBrandLogoUrl(nextLogoUrl);

      if (nextLogoUrl) {
        let favicon = document.querySelector(
          "link[rel*='icon']"
        ) as HTMLLinkElement | null;

        if (!favicon) {
          favicon = document.createElement("link");
          favicon.rel = "icon";
          document.head.appendChild(favicon);
        }

        favicon.href = nextLogoUrl;
      }
    };

    const fetchBranding = async () => {
      try {
        const platformResponse = await fetch("/api/platform-exists");
        const platformData = await platformResponse.json();
        document.title = platformData?.name?.trim() || "EMS Portal";

        const shouldUseOrganizationBranding = session?.user?.role === "ADMIN" || session?.user?.role === "USER";

        if (shouldUseOrganizationBranding) {
          const organizationResponse = await fetch("/api/organizations/me");
          if (organizationResponse.ok) {
            const organizationData = await organizationResponse.json();
            if (organizationData?.organization) {
              applyBrand(organizationData.organization);
              return;
            }
          }
        }

        applyBrand(platformData);
      } catch (error) {
        console.error("Failed to fetch branding settings:", error);
      }
    };

    void fetchBranding();

    return () => {
      active = false;
    };
  }, [session?.user?.role, status]);

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
        <div className="flex w-full items-center gap-3 px-2 text-indigo-900 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <EntityAvatar
            name={brandName}
            fallbackText={brandName}
            imageUrl={brandLogoUrl}
            rounded="xl"
            fit="contain"
            className="h-10 w-10 shrink-0 border border-indigo-100 bg-white shadow-sm shadow-indigo-200"
          />

          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight tracking-tight">
              {brandName}
            </p>
            {brandDescription ? (
              <p className="truncate text-xs text-slate-500">
                {brandDescription}
              </p>
            ) : null}
          </div>
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
              className="w-full rounded-xl px-3 py-5 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
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