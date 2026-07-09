"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { AuthCard } from "@/components/auth/auth-card";

const DEFAULT_BRAND_NAME = "EMS Portal";
const RESET_DRAFT_KEY = "reset-password-draft";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Something went wrong. Please try again.");
        return;
      }

      toast.success("A verification code has been sent to your email.");
      window.sessionStorage.setItem(RESET_DRAFT_KEY, JSON.stringify({ email }));
      router.push("/verify?flow=reset");
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthCard>

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Forgot your password?
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Enter the email address associated with your account and we&apos;ll send you a
        verification code to reset your password.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@organization.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 text-sm font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Sending code..." : "Send verification code"}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to login
      </Link>
    </AuthCard>
  );
}
