"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Sparkles, Activity, Lock, Eye, EyeOff, Check, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { passwordRequirements, passwordFieldSchema } from "@/lib/validations/password";
import { getDashboardPath } from "@/lib/role-routes";

function InviteAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setInviteError(data.error || "This invite link is invalid or has expired.");
          return;
        }
        setEmail(data.email);
        setOrganizationName(data.organizationName);
      })
      .catch(() => setInviteError("This invite link is invalid or has expired."))
      .finally(() => setChecking(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = passwordFieldSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid password");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to set password");
        return;
      }

      const signInRes = await signIn("credentials", { redirect: false, email, password });
      if (signInRes?.error) {
        toast.success("Password set! Please sign in.");
        router.push("/login");
        return;
      }
      toast.success("Welcome aboard!");
      const session = await getSession();
      router.push(getDashboardPath(session?.user?.role));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p className="text-sm text-slate-500">Checking your invite link...</p>;
  }

  if (inviteError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{inviteError}</p>
        <Link href="/login" className="text-xs font-medium text-indigo-600 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1">
        <Building2 className="h-3.5 w-3.5 text-indigo-600" />
        <p className="text-xs font-medium text-indigo-700">Join {organizationName}</p>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Set your password</h1>
      <p className="mt-2 text-sm text-slate-500">Create a password to activate your account.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" type="email" value={email} disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-password">Password</Label>
          <div className="relative">
            <Input
              id="invite-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {passwordRequirements.map((req) => {
              const met = req.test(password);
              return (
                <li
                  key={req.label}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    met ? "text-emerald-600" : "text-slate-400"
                  )}
                >
                  {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {req.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-confirm-password">Confirm password</Label>
          <Input
            id="invite-confirm-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-indigo-600 text-base hover:bg-indigo-700 cursor-pointer"
          disabled={submitting}
        >
          {submitting ? "Setting password..." : "Set password & sign in"}
        </Button>
      </form>
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        if (res.error === "ACCOUNT_DEACTIVATED") {
          toast.error("Your account has been deactivated. Contact your administrator.");
        } else if (res.error === "USER_NOT_FOUND") {
          toast.error("No account found for that email address.");
        } else if (res.error === "INVALID_PASSWORD") {
          toast.error("Incorrect password. Please try again.");
        } else if (res.error === "MISSING_CREDENTIALS") {
          toast.error("Please enter both email and password.");
        } else {
          toast.error(res.error === "CredentialsSignin" ? "Invalid email or password" : res.error);
        }
      } else {
        toast.success("Successfully logged in!");
        const session = await getSession();
        router.push(getDashboardPath(session?.user?.role));
        router.refresh();
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
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
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-12"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
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
    </>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const loginError = searchParams.get("error");
  const [platformName, setPlatformName] = useState("EMS Portal");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (loginError === "ACCOUNT_DEACTIVATED") {
      toast.error("Your account has been deactivated. Contact your administrator.");
    }
  }, [loginError]);

  useEffect(() => {
    fetch("/api/platform-exists")
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setPlatformName(data.name);
        if (data.logoURL) setLogoPreview(data.logoURL);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-white p-3 lg:p-4">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---------------- Left: form column ---------------- */}
        <div className="flex flex-col justify-center px-4 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            {inviteToken ? <InviteAcceptForm token={inviteToken} /> : <LoginForm />}
          </div>
        </div>

        {/* ---------------- Right: premium illustration column ---------------- */}
        <div className="relative hidden h-full overflow-hidden rounded-[32px] bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-10 border border-slate-800">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]" />

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginPageContent />
    </Suspense>
  );
}
