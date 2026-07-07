"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Sparkles, Activity, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [platformName, setPlatformName] = useState("EMS Portal");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform-exists")
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setPlatformName(data.name);
        if (data.logoURL) setLogoUrl(data.logoURL);
      })
      .catch(console.error);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        toast.error("Invalid email or password");
      } else {
        toast.success("Successfully logged in!");
        // We will just redirect to the root dashboard and let middleware or layout handle role routing
        // For now, let's redirect to super-admin dashboard by default to show it works
        router.push("/super-admin/dashboard");
        router.refresh();
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white p-3 lg:p-4">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---------------- Left: form column ---------------- */}
        <div className="flex flex-col justify-center px-4 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 shadow-inner">
              <Lock className="h-6 w-6 text-indigo-600" />
            </div>
            
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to your account to access the dashboard.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base rounded-xl cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </div>

        {/* ---------------- Right: premium illustration column ---------------- */}
        <div className="relative hidden h-full overflow-hidden rounded-[32px] bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-10 border border-slate-800">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
          
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <p className="text-xs font-medium text-slate-300">{platformName}</p>
            </div>
            <h2 className="mt-6 max-w-sm text-3xl font-light tracking-tight text-white lg:text-4xl">
              Powering modern <span className="font-semibold text-indigo-400">workforces</span>.
            </h2>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center">
            <div className="relative h-64 w-64">
              <div className="absolute inset-0 rounded-full border border-white/10 bg-indigo-500/10 flex items-center justify-center backdrop-blur-3xl animate-pulse duration-1000 overflow-hidden">
                <Activity className="h-20 w-20 text-indigo-400/50" />
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <ShieldCheck className="h-4 w-4 text-emerald-400" />
               <p className="text-xs text-slate-400">Secure connection</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
