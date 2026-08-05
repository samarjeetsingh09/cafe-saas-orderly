import type { Metadata } from "next";
import { LoginShell } from "@/components/auth/LoginShell";

export const metadata: Metadata = { title: "Cafe staff sign in" };

export default function Page() {
  return (
    <LoginShell
      variant="owner"
      eyebrow="Cafe staff"
      heading="Welcome back"
      subline="Owner, manager, waiter or kitchen — sign in with your email"
      endpoint="/api/auth/owner-login"
      redirectTo="/owner/orders"
    />
  );
}
