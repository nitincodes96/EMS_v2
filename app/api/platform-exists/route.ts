import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Ensure this route isn't overly cached since platform creation should reflect immediately
export const revalidate = 0;

export async function GET() {
  try {
    const platform = await prisma.platform.findFirst();
    return NextResponse.json({ exists: !!platform, name: platform?.name || null, logoURL: platform?.logoURL || null });
  } catch (error) {
    console.error("Error checking platform existence:", error);
    // Default to true on error to avoid accidentally exposing the register page to public
    return NextResponse.json({ exists: true, name: null }, { status: 500 });
  }
}
