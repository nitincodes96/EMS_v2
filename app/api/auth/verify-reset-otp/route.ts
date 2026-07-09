import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ message: "No account found for that email address." }, { status: 404 });
    }

    if (!user.otp || user.otp !== otp) {
      return NextResponse.json({ message: "Invalid verification code" }, { status: 400 });
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return NextResponse.json({ message: "Verification code has expired" }, { status: 400 });
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.user.update({
      where: { email },
      data: {
        otp: null,
        otpExpiry: null,
        resetToken,
        resetTokenExpiry,
      },
    });

    return NextResponse.json({ message: "Code verified", resetToken }, { status: 200 });
  } catch (error: any) {
    console.error("Verify reset OTP error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
