/**
 * Inline SVG icon set (Heroicons-style 20px solid paths, hand-trimmed).
 * Inline rather than a dependency: `plan/START-HERE.md` says add no
 * libraries, and HQ needs about a dozen glyphs.
 */
type P = { className?: string };
const svg = (d: string) =>
  function Icon({ className }: P) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
        <path d={d} />
      </svg>
    );
  };

export const IconGauge = svg(
  "M10 3.5a6.5 6.5 0 0 0-5.6 9.8.75.75 0 1 1-1.3.76A8 8 0 1 1 18 10a8 8 0 0 1-1.1 4.06.75.75 0 1 1-1.3-.76A6.5 6.5 0 0 0 10 3.5Zm3.4 3.2a.75.75 0 0 1 .13 1.05l-2.3 2.98a1.75 1.75 0 1 1-1.2-.92l2.32-3a.75.75 0 0 1 1.05-.12Z"
);
export const IconStore = svg(
  "M3.5 2.75A.75.75 0 0 1 4.25 2h11.5a.75.75 0 0 1 .74.63l.5 3A2.75 2.75 0 0 1 16 8.6v7.65a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1-.75-.75V13h-2v3.25a.75.75 0 0 1-.75.75h-3.5A.75.75 0 0 1 4 16.25V8.6a2.75 2.75 0 0 1-1-2.97l.5-3ZM5.5 9v6.5h2V12.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75V15.5h2V9h-9Z"
);
export const IconPulse = svg(
  "M8.7 3.3a.75.75 0 0 1 .7.5l3 8.4 1.6-3.5a.75.75 0 0 1 .68-.44h3.57a.75.75 0 0 1 0 1.5h-3.09l-2.3 5.03a.75.75 0 0 1-1.39-.06l-2.9-8.13-2.2 5.9a.75.75 0 0 1-.7.5H1.75a.75.75 0 0 1 0-1.5h3.13l2.83-7.6a.75.75 0 0 1 .7-.5Z"
);
export const IconFunnel = svg(
  "M2.6 3.4A.75.75 0 0 1 3.25 3h13.5a.75.75 0 0 1 .58 1.23L12 10.77v4.98a.75.75 0 0 1-1.1.66l-2.5-1.3a.75.75 0 0 1-.4-.67v-3.67L2.42 4.23a.75.75 0 0 1 .18-.83Z"
);
export const IconCard = svg(
  "M2 6.25A2.25 2.25 0 0 1 4.25 4h11.5A2.25 2.25 0 0 1 18 6.25V7H2v-.75ZM2 8.5v5.25A2.25 2.25 0 0 0 4.25 16h11.5A2.25 2.25 0 0 0 18 13.75V8.5H2Zm2.5 3.75a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"
);
export const IconLayers = svg(
  "M9.62 2.1a.75.75 0 0 1 .76 0l6.5 3.75a.75.75 0 0 1 0 1.3l-6.5 3.75a.75.75 0 0 1-.76 0l-6.5-3.75a.75.75 0 0 1 0-1.3l6.5-3.75ZM3.5 9.9l1.5.87 4.62 2.67a.75.75 0 0 0 .76 0L15 10.77l1.5-.87a.75.75 0 0 1 .38 1.4l-6.5 3.75a.75.75 0 0 1-.76 0l-6.5-3.75a.75.75 0 0 1 .38-1.4Z"
);
export const IconList = svg(
  "M3 4.75A.75.75 0 0 1 3.75 4h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 4.75Zm0 5A.75.75 0 0 1 3.75 9h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 9.75Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75Z"
);
export const IconChat = svg(
  "M10 2.5c-4.42 0-8 2.85-8 6.37 0 1.9 1.05 3.6 2.7 4.77-.13.9-.5 1.76-1.1 2.5a.5.5 0 0 0 .45.83 7.4 7.4 0 0 0 3.5-1.5c.78.2 1.6.3 2.45.3 4.42 0 8-2.85 8-6.37S14.42 2.5 10 2.5Z"
);
export const IconCog = svg(
  "M8.34 2.3a.75.75 0 0 1 .74-.63h1.84a.75.75 0 0 1 .74.63l.2 1.24c.45.16.87.38 1.25.66l1.17-.46a.75.75 0 0 1 .92.33l.92 1.6a.75.75 0 0 1-.18.95l-.98.78a5.6 5.6 0 0 1 0 1.44l.98.78a.75.75 0 0 1 .18.95l-.92 1.6a.75.75 0 0 1-.92.33l-1.17-.46c-.38.28-.8.5-1.25.66l-.2 1.24a.75.75 0 0 1-.74.63H9.08a.75.75 0 0 1-.74-.63l-.2-1.24a5.4 5.4 0 0 1-1.25-.66l-1.17.46a.75.75 0 0 1-.92-.33l-.92-1.6a.75.75 0 0 1 .18-.95l.98-.78a5.6 5.6 0 0 1 0-1.44l-.98-.78a.75.75 0 0 1-.18-.95l.92-1.6a.75.75 0 0 1 .92-.33l1.17.46c.38-.28.8-.5 1.25-.66l.2-1.24ZM10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
);
export const IconPlus = svg(
  "M10 3.25a.75.75 0 0 1 .75.75v5.25H16a.75.75 0 0 1 0 1.5h-5.25V16a.75.75 0 0 1-1.5 0v-5.25H4a.75.75 0 0 1 0-1.5h5.25V4a.75.75 0 0 1 .75-.75Z"
);
export const IconCheck = svg(
  "M16.7 5.3a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 0 1 1.06 0Z"
);
export const IconAlert = svg(
  "M8.49 3.17c.67-1.16 2.35-1.16 3.02 0l5.14 8.9c.67 1.16-.17 2.6-1.51 2.6H4.86c-1.34 0-2.18-1.44-1.51-2.6l5.14-8.9ZM10 6.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 10 6.5Zm0 6.5a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
);
export const IconKey = svg(
  "M12.5 2a5.5 5.5 0 0 0-5.2 7.3L2.3 14.3a1 1 0 0 0-.3.7v2a1 1 0 0 0 1 1h2a1 1 0 0 0 .7-.3l.8-.8V16a.75.75 0 0 1 .75-.75H8.5V14a.75.75 0 0 1 .75-.75h1.04l.4-.4A5.5 5.5 0 1 0 12.5 2Zm1.25 3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
);
export const IconLogin = svg(
  "M11 3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V4.5H5.5v11h4.75v-.75a.75.75 0 0 1 1.5 0v1.5A.75.75 0 0 1 11 17H4.75a.75.75 0 0 1-.75-.75V3.75A.75.75 0 0 1 4.75 3H11Zm3.22 4.22a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 1 1-1.06-1.06l.97-.97H9.25a.75.75 0 0 1 0-1.5h5.94l-.97-.97a.75.75 0 0 1 0-1.06Z"
);
export const IconTrash = svg(
  "M8.5 2a.75.75 0 0 0-.75.75V3.5H4.75a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H12.25V2.75A.75.75 0 0 0 11.5 2h-3ZM5.5 6.5h9l-.6 9.06A1.5 1.5 0 0 1 12.4 17H7.6a1.5 1.5 0 0 1-1.5-1.44L5.5 6.5Z"
);
export const IconPause = svg(
  "M6.5 3.5A1.5 1.5 0 0 0 5 5v10a1.5 1.5 0 0 0 3 0V5a1.5 1.5 0 0 0-1.5-1.5Zm7 0A1.5 1.5 0 0 0 12 5v10a1.5 1.5 0 0 0 3 0V5a1.5 1.5 0 0 0-1.5-1.5Z"
);
export const IconCopy = svg(
  "M7 3.25A2.25 2.25 0 0 1 9.25 1h5.5A2.25 2.25 0 0 1 17 3.25v7.5A2.25 2.25 0 0 1 14.75 13h-.5V6.5a3.25 3.25 0 0 0-3.25-3.25H7v0Zm-4 3A2.25 2.25 0 0 1 5.25 4h5.5A2.25 2.25 0 0 1 13 6.25v9.5A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75v-9.5Z"
);

/** Activity action → glyph + tone, so the log scans as a timeline not a wall of text. */
export function actionVisual(action: string): { Icon: (p: P) => React.JSX.Element; tone: "neutral" | "ok" | "warn" | "danger" | "brand" } {
  if (action.startsWith("cafe.provisioned") || action.startsWith("cafe.cloned")) return { Icon: IconPlus, tone: "ok" };
  if (action.startsWith("cafe.suspended") || action.startsWith("cafe.deleted")) return { Icon: IconAlert, tone: "danger" };
  if (action.startsWith("cafe.reactivated")) return { Icon: IconCheck, tone: "ok" };
  if (action.startsWith("cafe.impersonat")) return { Icon: IconLogin, tone: "brand" };
  if (action.startsWith("ticket.")) return { Icon: IconChat, tone: "neutral" };
  if (action.startsWith("theme.") || action.startsWith("template.")) return { Icon: IconLayers, tone: "neutral" };
  if (action.startsWith("menu.") || action.startsWith("order.")) return { Icon: IconList, tone: "neutral" };
  if (action.startsWith("plan.") || action.startsWith("subscription.")) return { Icon: IconCard, tone: "warn" };
  if (action.startsWith("cafe_user.password_reset") || action.startsWith("user.")) return { Icon: IconKey, tone: "warn" };
  if (action.startsWith("cafe_user.deactivated")) return { Icon: IconPause, tone: "danger" };
  if (action.startsWith("cafe_user.")) return { Icon: IconCheck, tone: "ok" };
  if (action.startsWith("lead.deleted")) return { Icon: IconTrash, tone: "danger" };
  if (action.startsWith("lead.")) return { Icon: IconFunnel, tone: "brand" };
  return { Icon: IconPulse, tone: "neutral" };
}
