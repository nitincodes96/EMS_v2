import { ReactNode } from "react";

export function AuthShell({
  children,
  panel,
}: {
  children: ReactNode;
  panel?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200 flex flex-col lg:flex-row min-h-[600px]">
        {/* ---------------- Left: Form Column ---------------- */}
        <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </div>

        {/* ---------------- Right: Banner Column ---------------- */}
        {panel && (
          <div className="hidden lg:flex flex-1 relative bg-slate-900 flex-col justify-between p-12 border-l border-slate-200 overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent" />
            {panel}
          </div>
        )}
      </div>
    </div>
  );
}
