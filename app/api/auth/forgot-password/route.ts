import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMailBrandName, sendMail } from "@/lib/mail";
import { otpEmailHtml } from "@/lib/email-templates";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ message: "No account found for that email address." }, { status: 404 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { email },
      data: { otp, otpExpiry },
    });

    const brandName = await getMailBrandName();

    await sendMail({
      to: email,
      subject: `Your ${brandName} password reset code`,
      html: otpEmailHtml({
        otp,
        intro: "Use the verification code below to reset your account password.",
        brandName,
      }),
      fromName: brandName,
    });

    return NextResponse.json({ message: "A verification code has been sent to your email." }, { status: 200 });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
