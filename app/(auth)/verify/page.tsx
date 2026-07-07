"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "react-hot-toast";

const DRAFT_KEY = "registration-draft";

export default function VerifyPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load email and password from session storage
    if (typeof window !== "undefined") {
      const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "{}");
      if (!draft.email) {
        // No email in draft, maybe they got here by accident
        router.push("/register");
        return;
      }
      setEmail(draft.email);
      if (draft.password) {
        setPassword(draft.password);
      }
    }
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) {
      toast.error("Please enter the verification code");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Verification failed");
        setIsLoading(false);
        return;
      }

      toast.success("Email verified successfully! Logging you in...");

      // Automatically log the user in
      if (password) {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          toast.error("Verification successful, but auto-login failed. Please log in manually.");
          setTimeout(() => router.push("/login"), 2000);
          return;
        }

        // Clean up session storage
        window.sessionStorage.removeItem(DRAFT_KEY);

        // Redirect to super admin page
        router.push("/super-admin/dashboard");
      } else {
        // If password wasn't saved for some reason, redirect to login
        router.push("/login");
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
      setIsLoading(false);
    }
  }

  async function handleResend() {
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to resend code");
      } else {
        toast.success("A new verification code has been sent to your email.");
      }
    } catch (err) {
      toast.error("An error occurred while resending the code.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Verify your email</h1>
          <p className="mt-2 text-sm text-slate-500">
            We sent a 6-digit verification code to <br />
            <span className="font-medium text-slate-900">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="size-10 sm:size-12 text-lg" />
                <InputOTPSlot index={1} className="size-10 sm:size-12 text-lg" />
                <InputOTPSlot index={2} className="size-10 sm:size-12 text-lg" />
                <InputOTPSlot index={3} className="size-10 sm:size-12 text-lg" />
                <InputOTPSlot index={4} className="size-10 sm:size-12 text-lg" />
                <InputOTPSlot index={5} className="size-10 sm:size-12 text-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={isLoading || otp.length < 6}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Verify Email"
            )}
            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-slate-500">
            Didn't receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              className="font-medium text-indigo-600 hover:underline"
            >
              Resend code
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
