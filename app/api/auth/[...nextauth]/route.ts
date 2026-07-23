import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { mockKerberosAuthenticate } from "@/lib/kerberos-mock";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Employee Code", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("MISSING_CREDENTIALS");
        }

        const user = await prisma.user.findFirst({
          where: { OR: [{ email: credentials.identifier }, { empCode: credentials.identifier }] }
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        if (!user.isVerified) {
          throw new Error("Please verify your email address before logging in.");
        }

        if (!user.password) {
          throw new Error("Please set your password using the invite link sent to your email.");
        }

        if (!user.isActive) {
          throw new Error("ACCOUNT_DEACTIVATED");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("INVALID_PASSWORD");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          photoUrl: user.photoUrl,
          role: user.role,
          departmentId: user.departmentId,
        };
      }
    }),
    CredentialsProvider({
      id: "kerberos",
      name: "Kerberos",
      credentials: {
        kerberosId: { label: "Kerberos ID", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.kerberosId || !credentials?.password) {
          throw new Error("MISSING_CREDENTIALS");
        }

        // TODO: replace with verification against IITD's real Kerberos/SSO
        // assertion once available. This never trusts client-supplied role
        // or department — both are derived server-side from the (mock)
        // assertion, matched against departments that already exist in our
        // database, and only FACULTY accounts are provisioned this way.
        const claims = mockKerberosAuthenticate(credentials.kerberosId, credentials.password);
        if (!claims || !claims.is_verified) {
          throw new Error("KERBEROS_AUTH_FAILED");
        }

        if (!claims.roles.includes("faculty")) {
          throw new Error("NOT_FACULTY");
        }

        const department = await prisma.department.findUnique({
          where: { slug: claims.department },
        });
        if (!department) {
          throw new Error("DEPARTMENT_NOT_REGISTERED");
        }

        let user = await prisma.user.findUnique({ where: { email: claims.email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: claims.email,
              username: claims.preferred_username,
              name: claims.name,
              password: null,
              role: "FACULTY",
              departmentId: department.id,
              isVerified: true,
              status: "ACCEPTED",
              isActive: true,
            },
          });
        } else {
          if (!user.isActive) {
            throw new Error("ACCOUNT_DEACTIVATED");
          }
          if (user.role !== "FACULTY") {
            throw new Error("ROLE_MISMATCH");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          photoUrl: user.photoUrl,
          role: user.role,
          departmentId: user.departmentId,
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.departmentId = user.departmentId;
        token.photoUrl = (user as { photoUrl?: string | null }).photoUrl ?? null;
        token.isActive = true;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.departmentId = token.departmentId as string | null;
        session.user.photoUrl = token.photoUrl as string | null;
        session.user.image = token.photoUrl as string | undefined;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
