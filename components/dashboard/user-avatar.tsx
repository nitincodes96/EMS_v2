"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Menu } from "@base-ui/react/menu";
import { LogOut, User } from "lucide-react";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { cn } from "@/lib/utils";

const SETTINGS_PATH_BY_ROLE: Record<string, string> = {
  ADMIN: "/admin/settings",
  FACULTY: "/faculty/settings",
  MODERATOR: "/moderator/settings",
  PROJECT_ASSISTANT: "/project-assistant/settings",
};

function capitalizeName(name: string): string {
  return name.replace(/\S+/g, (word) => word[0].toUpperCase() + word.slice(1));
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "from-indigo-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function UserAvatar() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="h-9 w-9 rounded-full bg-indigo-100 shrink-0" />
        <div className="hidden sm:flex flex-col gap-1">
          <div className="h-3 w-20 rounded bg-indigo-100" />
          <div className="h-2.5 w-28 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  const rawUsername: string = session.user.name ?? "User";
  const username = capitalizeName(rawUsername);
  const email: string = session.user.email ?? "";
  const photoUrl = session.user.photoUrl ?? session.user.image ?? null;
  const initials = getInitials(username);
  const gradientClass = pickColor(rawUsername);
  const role = (session.user as any).role as string | undefined;
  const settingsPath = (role && SETTINGS_PATH_BY_ROLE[role]) || "/";

  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex cursor-pointer items-center gap-3 rounded-xl p-1 pr-2 transition-colors hover:bg-slate-100 data-popup-open:bg-slate-100"
        aria-label="Account menu"
      >
        {/* Avatar circle */}
        <div
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} text-white text-sm font-semibold shadow-md ring-2 ring-white select-none`}
          title={`${username} (${email})`}
        >
          {photoUrl ? (
            <EntityAvatar
              name={username}
              fallbackText={email}
              imageUrl={photoUrl}
              className="h-full w-full rounded-full"
            />
          ) : (
            initials
          )}
          {/* Online indicator */}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 shadow-sm" />
        </div>

        {/* Name + email */}
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold text-slate-800 truncate max-w-[140px]">
            {username}
          </span>
          <span className="text-xs text-slate-400 truncate max-w-[160px]">
            {email}
          </span>
        </div>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Menu.Popup
            className={cn(
              "w-52 origin-(--transform-origin) overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            <Menu.Item
              render={<Link href={settingsPath} />}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors data-highlighted:bg-indigo-50 data-highlighted:text-indigo-700"
            >
              <User className="h-4 w-4 text-slate-400" /> Profile
            </Menu.Item>
            <Menu.Item
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 outline-none transition-colors data-highlighted:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Logout
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
