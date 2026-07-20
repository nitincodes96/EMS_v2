import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationCount = await prisma.organization.count();
  
  if (organizationCount > 0) {
    redirect("/login");
  }

  return <>{children}</>;
}
