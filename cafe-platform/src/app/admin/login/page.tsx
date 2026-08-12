import type { Metadata } from "next";
import { LoginShell } from "@/components/auth/LoginShell";

export const metadata: Metadata = { title: "Cafiyara HQ sign in" };

export default function Page() {
  return (
    <LoginShell
      variant="admin"
      eyebrow="Cafiyara HQ"
      heading="Platform staff"
      subline="Sign in to manage cafes, provisioning and support"
      endpoint="/api/auth/admin-login"
      redirectTo="/admin"
    />
  );
}
