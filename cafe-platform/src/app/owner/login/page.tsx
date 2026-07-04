import type { Metadata } from "next";
import { LoginShell } from "@/components/auth/LoginShell";

export const metadata: Metadata = { title: "Owner sign in" };

export default function Page() {
  return (
    <LoginShell
      variant="owner"
      eyebrow="Owner portal"
      heading="Welcome back"
      subline="Sign in to manage your cafe"
      endpoint="/api/auth/owner-login"
      redirectTo="/owner/home"
    />
  );
}
