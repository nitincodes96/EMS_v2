import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

const DEFAULT_BRAND_NAME = "EMS Portal";
const DEFAULT_FROM_EMAIL = "no-reply@ems.com";

function extractEmailAddress(fromValue?: string | null): string {
  if (!fromValue) {
    return DEFAULT_FROM_EMAIL;
  }

  const trimmedValue = fromValue.trim();
  const angleMatch = trimmedValue.match(/<([^>]+)>/);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim();
  }

  const emailMatch = trimmedValue.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if (emailMatch?.[0]) {
    return emailMatch[0];
  }

  return DEFAULT_FROM_EMAIL;
}

export async function getMailBrandName(): Promise<string> {
  const organization = await prisma.organization.findFirst({ select: { name: true } });
  return organization?.name?.trim() || DEFAULT_BRAND_NAME;
}

function buildFromHeader(brandName: string, smtpFrom?: string | null): string {
  const emailAddress = extractEmailAddress(smtpFrom);
  const safeBrandName = brandName.replace(/"/g, '\\"');
  return `"${safeBrandName}" <${emailAddress}>`;
}

export async function sendMail({
  to,
  subject,
  html,
  fromName,
}: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  const brandName = fromName || (await getMailBrandName());

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "587"),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: buildFromHeader(brandName, SMTP_FROM),
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
