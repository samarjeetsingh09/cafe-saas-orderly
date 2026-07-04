import { LoginForm } from "./LoginForm";

/**
 * Shared login layout. Owner portal sits on the cream brand field;
 * founder portal on a dark roasted field — instantly distinguishable
 * so nobody types credentials into the wrong portal.
 */
type Props = {
  variant: "owner" | "admin";
  eyebrow: string;
  heading: string;
  subline: string;
  endpoint: string;
  redirectTo: string;
};

export function LoginShell({ variant, eyebrow, heading, subline, endpoint, redirectTo }: Props) {
  const dark = variant === "admin";
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center px-4 py-10 ${
        dark ? "bg-[#241305] text-[#f5ede3]" : "bg-background"
      }`}
    >
      {/* Signature: espresso-ring mark — cup seen from above */}
      <div
        aria-hidden="true"
        className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 ${
          dark ? "border-[#d97706]" : "border-primary"
        }`}
      >
        <span
          className={`block h-8 w-8 rounded-full border-2 ${
            dark ? "border-[#d97706]/60" : "border-primary/50"
          }`}
        />
      </div>

      <p
        className={`mb-1 text-xs font-semibold uppercase tracking-[0.2em] ${
          dark ? "text-[#d97706]" : "text-accent"
        }`}
      >
        {eyebrow}
      </p>
      <h1 className={`text-2xl font-bold ${dark ? "text-[#f5ede3]" : "text-primary"}`}>
        {heading}
      </h1>
      <p className={`mt-1 mb-8 text-sm ${dark ? "text-[#f5ede3]/70" : "text-muted"}`}>{subline}</p>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-foreground shadow-sm">
        <LoginForm endpoint={endpoint} redirectTo={redirectTo} />
      </div>

      <p className={`mt-6 text-xs ${dark ? "text-[#f5ede3]/50" : "text-muted"}`}>
        Forgot your password? Contact support to reset it.
      </p>
    </main>
  );
}
