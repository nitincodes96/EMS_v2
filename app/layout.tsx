import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "react-hot-toast";

const velique = localFont({
  src: "../public/fonts/Velique Sans Regular.otf",
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import prisma from "@/lib/prisma";

export async function generateMetadata(): Promise<Metadata> {
  let platformName = "Employee Management System";
  let logoUrl = "/favicon.ico";
  try {
    const platform = await prisma.platform.findFirst();
    if (platform?.name) {
      platformName = platform.name;
    }
    if (platform?.logoURL) {
      logoUrl = platform.logoURL;
    }
  } catch (error) {
    console.error("Failed to load platform info:", error);
  }
  return {
    title: platformName,
    description: "This is an employee management system.",
    icons: {
      icon: logoUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${velique.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextTopLoader color="#4f46e5" showSpinner={false} />
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}