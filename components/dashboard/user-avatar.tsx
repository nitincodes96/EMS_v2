"use client";

import { useSession } from "next-auth/react";
import { EntityAvatar } from "@/components/shared/entity-avatar";

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

  const username: string = (session.user as any).username ?? session.user.name ?? "User";
  const email: string = session.user.email ?? "";
  const photoUrl = session.user.photoUrl ?? session.user.image ?? null;
  const initials = getInitials(username);
  const gradientClass = pickColor(username);

  return (
    <div className="flex items-center gap-3 group">
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
      <div className="hidden sm:flex flex-col leading-tight">
        <span className="text-sm font-semibold text-slate-800 truncate max-w-[140px]">
          {username}
        </span>
        <span className="text-xs text-slate-400 truncate max-w-[160px]">
          {email}
        </span>
      </div>
    </div>
  );
}
