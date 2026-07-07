import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const platformCount = await prisma.platform.count();
  
  if (platformCount > 0) {
    redirect("/login");
  }

  return <>{children}</>;
}
