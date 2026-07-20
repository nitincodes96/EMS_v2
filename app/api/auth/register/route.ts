import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getMailBrandName, sendMail } from "@/lib/mail";
import { otpEmailHtml } from "@/lib/email-templates";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { organizationName, logoBase64, username, email, password } = body;

    if (!organizationName || !username || !email || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      if (!existingUser.isVerified) {
         // Optionally, they could resend OTP, but let's just reject for now or tell them to verify
         return NextResponse.json({ message: "User exists but is not verified. Please verify your email or login to resend OTP." }, { status: 400 });
      }
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
    }

    // Check if organization already exists
    const organizationCount = await prisma.organization.count();
    if (organizationCount > 0) {
      return NextResponse.json({ message: "A organization is already registered." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let logoURL: string | null = null;
    if (logoBase64) {
      try {
        const match = logoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (match && match.length === 3) {
          const mimeType = match[1];
          const base64Data = match[2];
          const extension = mimeType.split('/')[1] === 'svg+xml' ? 'svg' : mimeType.split('/')[1];
          
          const filename = `${crypto.randomUUID()}.${extension}`;
          const uploadsDir = path.join(process.cwd(), 'uploads', 'organization');
          
          await fs.mkdir(uploadsDir, { recursive: true });
          
          const filePath = path.join(uploadsDir, filename);
          await fs.writeFile(filePath, base64Data, 'base64');
          
          logoURL = `/api/upload/organization/${filename}`;
        }
      } catch (err) {
        console.error("Error saving logo:", err);
      }
    }

    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "ADMIN" : "PROJECT_ASSISTANT";

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await prisma.$transaction(async (tx) => {
      await tx.organization.create({
        data: {
          name: organizationName,
          logoURL: logoURL,
        }
      });

      return await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          role: role,
          otp,
          otpExpiry,
          isVerified: false
        }
      });
    });

    const brandName = await getMailBrandName();

    await sendMail({
      to: email,
      subject: `Verify your ${brandName} account`,
      html: otpEmailHtml({
        otp,
        intro: `Use the verification code below to activate your new ${brandName} account.`,
        brandName,
      }),
      fromName: brandName,
    });

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      { message: "Registration successful. Please verify OTP.", user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
