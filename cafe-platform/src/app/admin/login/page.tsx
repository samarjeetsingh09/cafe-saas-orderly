import type { Metadata } from "next";
import { LoginShell } from "@/components/auth/LoginShell";

export const metadata: Metadata = { title: "Founder sign in" };

export default function Page() {
  return (
    <LoginShell
      variant="admin"
      eyebrow="Founder portal"
      heading="Platform admin"
      subline="Sign in to manage cafes and billing"
      endpoint="/api/auth/admin-login"
      redirectTo="/admin/cafes"
    />
  );
}
