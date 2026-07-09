import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { passwordSchema } from "@/lib/validations/password";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, resetToken, password, confirmPassword } = body;

    if (!email || !resetToken) {
      return NextResponse.json({ message: "Missing or invalid reset session. Please start again." }, { status: 400 });
    }

    const parsed = passwordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid password" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.resetToken || user.resetToken !== resetToken) {
      return NextResponse.json({ message: "Missing or invalid reset session. Please start again." }, { status: 400 });
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return NextResponse.json({ message: "Your reset session has expired. Please start again." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return NextResponse.json({ message: "Password reset successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
