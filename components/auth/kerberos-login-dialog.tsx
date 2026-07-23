"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "react-hot-toast";
import { getDashboardPath } from "@/lib/role-routes";

const KERBEROS_ERROR_MESSAGES: Record<string, string> = {
  MISSING_CREDENTIALS: "Please enter both your Kerberos ID and password.",
  KERBEROS_AUTH_FAILED: "Invalid Kerberos ID or password.",
  NOT_FACULTY: "This login is available for Faculty accounts only.",
  DEPARTMENT_NOT_REGISTERED:
    "Your department isn't registered with this organization yet. Contact your administrator.",
  ACCOUNT_DEACTIVATED: "Your account has been deactivated. Contact your administrator.",
  ROLE_MISMATCH: "This account isn't registered as Faculty.",
  CredentialsSignin: "Invalid Kerberos ID or password.",
};

export function KerberosLoginDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kerberosId, setKerberosId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setKerberosId("");
    setPassword("");
    setShowPassword(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await signIn("kerberos", {
        redirect: false,
        kerberosId,
        password,
      });

      if (res?.error) {
        toast.error(KERBEROS_ERROR_MESSAGES[res.error] || res.error);
        return;
      }

      toast.success("Successfully logged in.");
      setOpen(false);
      resetForm();
      const session = await getSession();
      router.push(getDashboardPath(session?.user?.role));
      router.refresh();
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 rounded-md border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          />
        }
      >
        <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-sm">
          <Image
            src="/IITD_LOGO.svg"
            alt="IIT Delhi"
            width={20}
            height={20}
            unoptimized
            className="h-5 w-5 object-contain"
          />
        </span>
        Continue with Kerberos (Faculty)
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
              <Image
                src="/IITD_LOGO.svg"
                alt="IIT Delhi"
                width={24}
                height={24}
                unoptimized
                className="h-6 w-6 object-contain"
              />
            </span>
            <DialogTitle className="text-slate-900">Faculty Kerberos Login</DialogTitle>
          </div>
          <DialogDescription>
            For Faculty accounts only. Sign in with your Institute Kerberos credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kerberos-id" className="text-slate-700">
              Kerberos ID
            </Label>
            <Input
              id="kerberos-id"
              type="text"
              placeholder="name@department.iitd.ac.in"
              value={kerberosId}
              onChange={(e) => setKerberosId(e.target.value)}
              autoComplete="username"
              required
              className="rounded-md"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kerberos-password" className="text-slate-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="kerberos-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="pr-12 rounded-md"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Available for Faculty accounts only. This is a mock of the real IITD Kerberos SSO —
            any password works, and your department is read from the Kerberos ID's domain.
          </p>

          <Button
            type="submit"
            className="w-full h-10 rounded-md bg-indigo-600 text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in with Kerberos"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
