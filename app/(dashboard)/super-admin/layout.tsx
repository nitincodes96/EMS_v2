"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionProvider } from "next-auth/react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-slate-50/50">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-indigo-100/60 bg-white/80 px-6 backdrop-blur-md sticky top-0 z-10">
            <SidebarTrigger className="text-indigo-600 hover:bg-indigo-50 -ml-2" />
            <div className="h-4 w-px bg-indigo-200 mx-2" />
            <h1 className="text-sm font-medium text-slate-600">Super Admin</h1>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
