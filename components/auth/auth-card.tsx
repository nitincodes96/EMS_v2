import { ReactNode } from "react";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        {children}
      </div>
    </div>
  );
}
