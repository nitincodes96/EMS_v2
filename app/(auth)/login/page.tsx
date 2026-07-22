"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Check, X, Building2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { passwordRequirements, passwordFieldSchema } from "@/lib/validations/password";
import { getDashboardPath } from "@/lib/role-routes";
import { BrandMark } from "@/components/auth/brand-mark";
import { AuthShell } from "@/components/auth/auth-shell";

function LoginForm({ organizationName, logoUrl }: { organizationName: string; logoUrl: string | null }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        identifier,
        password,
      });

      if (res?.error) {
        if (res.error === "ACCOUNT_DEACTIVATED") {
          toast.error("Your account has been deactivated. Contact your administrator.");
        } else if (res.error === "USER_NOT_FOUND") {
          toast.error("No account found for that email or employee code.");
        } else if (res.error === "INVALID_PASSWORD") {
          toast.error("Incorrect password. Please try again.");
        } else if (res.error === "MISSING_CREDENTIALS") {
          toast.error("Please enter both email and password.");
        } else {
          toast.error(res.error === "CredentialsSignin" ? "Invalid email or password" : res.error);
        }
      } else {
        toast.success("Successfully logged in.");
        const session = await getSession();
        router.push(getDashboardPath(session?.user?.role));
        router.refresh();
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <BrandMark organizationName={organizationName} logoUrl={logoUrl} />

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Account Login
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Authenticate to access your department workspace.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-slate-700">Email or Employee Code</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="admin@department.com or employee code"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="rounded-md"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
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
                className="pr-12 rounded-md"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 text-sm font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Authenticating..." : "Sign In"}
        </Button>
      </form>
    </>
  );
}

function InviteAcceptForm({ token, organizationName, logoUrl }: { token: string; organizationName: string; logoUrl: string | null }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [email, setEmail] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [departmentName, setDepartmentName] = useState("");
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
        setEmail(data.email || "");
        setEmpCode(data.empCode || "");
        setDepartmentName(data.departmentName);
      })
      .catch(() => setInviteError("This invite link is invalid or has expired."))
      .finally(() => setChecking(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = passwordFieldSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
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
        toast.error(data.error || "Failed to set password.");
        return;
      }

      const signInRes = await signIn("credentials", { redirect: false, identifier: email || empCode, password });
      if (signInRes?.error) {
        toast.success("Password configured. Please sign in.");
        router.push("/login");
        return;
      }
      toast.success("Account activated successfully.");
      const session = await getSession();
      router.push(getDashboardPath(session?.user?.role));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p className="text-sm text-slate-500">Verifying security token...</p>;
  }

  if (inviteError) {
    return (
      <div className="space-y-3 p-4 border border-red-100 bg-red-50 rounded-md">
        <p className="text-sm font-medium text-red-800">{inviteError}</p>
        <Link href="/login" className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
          Return to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <BrandMark organizationName={organizationName} logoUrl={logoUrl} />
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Account Activation</h1>
      <p className="mt-2 text-sm text-slate-500">Configure your credentials for {departmentName || "your department"}.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="invite-email" className="text-slate-700">{email ? "Email Address" : "Employee Code"}</Label>
          <Input id="invite-email" type="text" value={email || empCode} disabled className="rounded-md bg-slate-50" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-password" className="text-slate-700">New Password</Label>
          <div className="relative">
            <Input
              id="invite-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10 rounded-md"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-md">
            {passwordRequirements.map((req) => {
              const met = req.test(password);
              return (
                <li
                  key={req.label}
                  className={cn(
                    "flex items-center gap-2 text-xs font-medium transition-colors",
                    met ? "text-emerald-700" : "text-slate-500"
                  )}
                >
                  {met ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                  {req.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-confirm-password" className="text-slate-700">Confirm Password</Label>
          <Input
            id="invite-confirm-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="rounded-md"
          />
        </div>

        <Button
          type="submit"
          className="h-10 w-full rounded-md bg-indigo-600 text-sm font-medium hover:bg-indigo-700 transition-colors mt-2"
          disabled={submitting}
        >
          {submitting ? "Processing..." : "Activate Account"}
        </Button>
      </form>
    </>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const loginError = searchParams.get("error");
  const [organizationName, setOrganizationName] = useState("Enterprise Systems");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (loginError === "ACCOUNT_DEACTIVATED") {
      toast.error("Your account has been deactivated. Contact your administrator.");
    }
  }, [loginError]);

  useEffect(() => {
    fetch("/api/organization-exists")
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setOrganizationName(data.name);
        if (data.logoURL) setLogoPreview(data.logoURL);
      })
      .catch(console.error);
  }, []);

  return (
    <AuthShell
      panel={
        <>
          {/* Top Section */}
          <div className="relative z-10">
            <h2 className="text-3xl font-medium tracking-tight text-white leading-tight">
              Enterprise-grade <br />
              management for <br />
              <span className="text-slate-400">modern departments.</span>
            </h2>
            <p className="mt-4 text-sm text-slate-400 max-w-sm leading-relaxed">
              Streamline operations, manage resources securely, and gain comprehensive oversight through a centralized command portal.
            </p>
          </div>

          {/* Bottom Section */}
          <div className="relative z-10 w-full pt-8 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">
                  Encrypted Connection
                </span>
              </div>
              <span className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} {organizationName}.
              </span>
            </div>
          </div>
        </>
      }
    >
      {inviteToken ? (
        <InviteAcceptForm token={inviteToken} organizationName={organizationName} logoUrl={logoPreview} />
      ) : (
        <LoginForm organizationName={organizationName} logoUrl={logoPreview} />
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginPageContent />
    </Suspense>
  );
}