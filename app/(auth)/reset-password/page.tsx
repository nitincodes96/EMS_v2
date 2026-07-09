"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, X, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { passwordRequirements, passwordFieldSchema } from "@/lib/validations/password";
import { AuthCard } from "@/components/auth/auth-card";

const RESET_SESSION_KEY = "reset-password-session";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const session = JSON.parse(window.sessionStorage.getItem(RESET_SESSION_KEY) ?? "{}");
    if (!session.email || !session.resetToken) {
      router.push("/forgot-password");
      return;
    }
    setEmail(session.email);
    setResetToken(session.resetToken);
  }, [router]);

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

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, password, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to reset password.");
        return;
      }

      window.sessionStorage.removeItem(RESET_SESSION_KEY);
      toast.success("Password reset successfully. Please sign in.");
      router.push("/login");
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthCard>
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <KeyRound className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Set a new password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose a strong new password for <br />
          <span className="font-medium text-slate-900">{email}</span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-700">New Password</Label>
          <div className="relative">
            <Input
              id="password"
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
          <Label htmlFor="confirmPassword" className="text-slate-700">Confirm Password</Label>
          <Input
            id="confirmPassword"
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
          className="h-10 w-full rounded-md bg-indigo-600 text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Resetting..." : "Reset password"}
        </Button>
      </form>
    </AuthCard>
  );
}
