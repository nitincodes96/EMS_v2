import * as z from "zod";

export const departmentSchema = z.object({
  departmentName: z.string().min(1, "Department name is required"),
  logo: z.any().optional(),
});

export type DepartmentValues = z.infer<typeof departmentSchema>;

export const accountSchema = z.object({
  username: z.string().min(1, "Username is required"),
  userId: z.string().min(1, "User ID is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one symbol"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type AccountValues = z.infer<typeof accountSchema>;
