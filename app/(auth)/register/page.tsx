"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Activity,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Layers,
  Lock,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { passwordRequirements, passwordFieldSchema } from "@/lib/validations/password";
import { BrandMark } from "@/components/auth/brand-mark";
import { AuthShell } from "@/components/auth/auth-shell";

const DEFAULT_BRAND_NAME = "EMS Portal";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const platformSchema = z.object({
  platformName: z
    .string()
    .min(2, "Platform name must be at least 2 characters")
    .max(80, "Platform name is too long"),
  logo: z
    .custom<File | undefined>()
    .refine(
      (file) => !file || file.size <= 4 * 1024 * 1024,
      "Logo must be smaller than 4MB"
    )
    .refine(
      (file) =>
        !file ||
        ["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(
          file.type
        ),
      "Logo must be a PNG, JPG, WEBP or SVG"
    )
    .optional(),
});
type PlatformValues = z.infer<typeof platformSchema>;

const accountSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username is too long")
      .regex(/^[a-zA-Z0-9_. ]+$/, "Only letters, numbers, spaces, . and _ are allowed"),
    email: z.string().email("Invalid email address"),
    password: passwordFieldSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type AccountValues = z.infer<typeof accountSchema>;

const PASSWORD_REQUIREMENTS = passwordRequirements;

const DRAFT_KEY = "registration-draft";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // step 1 state
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const platformForm = useForm<PlatformValues>({
    resolver: zodResolver(platformSchema),
    defaultValues: { platformName: "" },
  });

  // step 2 state
  const [showPassword, setShowPassword] = useState(false);

  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = accountForm.watch("password") ?? "";

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    platformForm.setValue("logo", file, { shouldValidate: true });
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'icon';
      link.href = result;
      document.getElementsByTagName('head')[0].appendChild(link);
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    platformForm.setValue("logo", undefined);
    setLogoPreview(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) {
      link.href = "/favicon.ico";
    }
  }

  function handlePlatformSubmit(values: PlatformValues) {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          platformName: values.platformName,
          logoName: values.logo?.name,
          logoPreview,
        })
      );
    }
    setStep(2);
  }

  async function handleAccountSubmit(values: AccountValues) {
    if (typeof window !== "undefined") {
      const existing = JSON.parse(
        window.sessionStorage.getItem(DRAFT_KEY) ?? "{}"
      );

      const payload = {
        platformName: existing.platformName,
        logoBase64: existing.logoPreview,
        username: values.username,
        email: values.email,
        password: values.password,
      };

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json();
          toast.error(errorData.message || "Registration failed");
          return;
        }
      } catch (err) {
        console.error(err);
        toast.error("An unexpected error occurred");
        return;
      }

      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          ...existing,
          username: values.username,
          email: values.email,
          password: values.password,
        })
      );
    }

    toast.success("Account created! Please verify your email.");
    router.push("/verify");
  }

  return (
    <AuthShell
      panel={
        <>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <p className="text-xs font-medium text-slate-300">EMS Portal v2.0</p>
            </div>
            <h2 className="mt-6 max-w-sm text-3xl font-light tracking-tight text-white lg:text-4xl">
              Elevate your <span className="font-semibold text-indigo-400">workforce</span> management.
            </h2>
            <p className="mt-4 max-w-md text-slate-400">
              Streamline HR tasks, engage your team, and scale your organization with our comprehensive suite of tools designed for modern enterprises.
            </p>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center">
            {/* Abstract UI representation */}
            <div className="relative w-full max-w-sm">
              {/* Main dashboard card */}
              <div className="relative z-20 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl transition-transform hover:scale-105 duration-500">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 p-[1px]">
                      <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                        ) : (
                          <Activity className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="h-3 w-24 rounded-full bg-slate-800 mb-2" />
                      <div className="h-2 w-16 rounded-full bg-slate-800/60" />
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full border border-white/10 bg-slate-800/50 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>

                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        <div className="h-2 w-20 rounded-full bg-slate-700" />
                      </div>
                      <div className="h-2 w-8 rounded-full bg-slate-800" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating element 1 */}
              <div className="absolute -right-8 -top-8 z-30 animate-pulse rounded-2xl border border-white/10 bg-slate-800/90 p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                    <Lock className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">System Secure</p>
                    <p className="text-xs text-slate-400">All data encrypted</p>
                  </div>
                </div>
              </div>

              {/* Floating element 2 */}
              <div className="absolute -bottom-6 -left-6 z-10 rounded-2xl border border-white/10 bg-indigo-500/20 p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center">
                        <span className="text-[10px] text-slate-400">{i}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-indigo-500/30 px-2 py-1">
                    <Users className="h-3 w-3 text-indigo-300" />
                    <span className="text-xs font-medium text-indigo-200">+120</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <BrandMark platformName={DEFAULT_BRAND_NAME} logoUrl={logoPreview ?? null} />

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Create your workspace
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Set up your Platform, then your account.
      </p>

            <ol className="mb-8 mt-8 flex items-center gap-3">
              {[
                { label: "Platform", description: "Name & logo" },
                { label: "Account", description: "Your details" },
              ].map((s, index) => {
                const stepNumber = (index + 1) as 1 | 2;
                const isComplete = stepNumber < step;
                const isActive = stepNumber === step;
                return (
                  <li key={s.label} className="flex items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                          isComplete && "border-indigo-600 bg-indigo-600 text-white",
                          isActive &&
                          "border-indigo-600 bg-white text-indigo-600 ring-4 ring-indigo-50",
                          !isComplete &&
                          !isActive &&
                          "border-slate-200 bg-white text-slate-400"
                        )}
                      >
                        {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                      </span>
                      <div className="hidden sm:block">
                        <p
                          className={cn(
                            "text-sm font-medium leading-tight",
                            isActive || isComplete
                              ? "text-slate-900"
                              : "text-slate-400"
                          )}
                        >
                          {s.label}
                        </p>
                        <p className="text-xs leading-tight text-slate-400">
                          {s.description}
                        </p>
                      </div>
                    </div>
                    {stepNumber !== 2 && (
                      <div
                        className={cn(
                          "h-px w-8 rounded-full transition-colors sm:w-12",
                          isComplete ? "bg-indigo-600" : "bg-slate-200"
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ol>

            {/* ---------------- Step 1: Platform ---------------- */}
            {step === 1 && (
              <form
                className="space-y-5"
                onSubmit={platformForm.handleSubmit(handlePlatformSubmit)}
              >
                <div className="space-y-2">
                  <Label htmlFor="platformName">Platform name</Label>
                  <Input
                    id="platformName"
                    placeholder="Enter Platform Name"
                    autoFocus
                    {...platformForm.register("platformName")}
                  />
                  {platformForm.formState.errors.platformName && (
                    <p className="text-xs text-red-500">
                      {platformForm.formState.errors.platformName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Platform logo</Label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-500"
                    >
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="h-5 w-5" />
                      )}
                    </button>

                    <div className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {logoPreview ? "Replace logo" : "Upload logo"}
                      </Button>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={clearLogo}
                          className="ml-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500"
                        >
                          <X className="h-3 w-3" /> Remove
                        </button>
                      )}
                      <p className="mt-1.5 text-xs text-slate-400">
                        PNG, JPG, WEBP or SVG. Max 4MB. Optional — add later.
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  {platformForm.formState.errors.logo && (
                    <p className="text-xs text-red-500">
                      {platformForm.formState.errors.logo.message as string}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                  disabled={platformForm.formState.isSubmitting}
                >
                  Continue
                </Button>
              </form>
            )}

            {/* ---------------- Step 2: Account ---------------- */}
            {step === 2 && (
              <form
                className="space-y-5"
                onSubmit={accountForm.handleSubmit(handleAccountSubmit)}
              >
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter Username"
                    autoFocus
                    {...accountForm.register("username")}
                  />
                  {accountForm.formState.errors.username && (
                    <p className="text-xs text-red-500">
                      {accountForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Admin Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter Your Email Id"
                    {...accountForm.register("email")}
                  />
                  {accountForm.formState.errors.email && (
                    <p className="text-xs text-red-500">
                      {accountForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      {...accountForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {PASSWORD_REQUIREMENTS.map((req) => {
                      const met = req.test(passwordValue);
                      return (
                        <li
                          key={req.label}
                          className={cn(
                            "flex items-center gap-1.5 text-xs transition-colors",
                            met ? "text-emerald-600" : "text-slate-400"
                          )}
                        >
                          {met ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          {req.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...accountForm.register("confirmPassword")}
                  />
                  {accountForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-500">
                      {accountForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                    disabled={accountForm.formState.isSubmitting}
                  >
                    {accountForm.formState.isSubmitting
                      ? "Sending code..."
                      : "Sign up"}
                  </Button>
                </div>
              </form>
            )}
    </AuthShell>
  );
}