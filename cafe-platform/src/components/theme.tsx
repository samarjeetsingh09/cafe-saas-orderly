const KEY_TO_VAR: Record<string, string> = {
  bg: "--bg",
  surface: "--surface",
  surface2: "--surface-2",
  ink: "--ink",
  inkDim: "--ink-dim",
  inkFaint: "--ink-faint",
  line: "--line",
  accent: "--accent",
  accent2: "--accent-2",
  veg: "--veg",
  nonveg: "--nonveg",
  warn: "--warn",
  danger: "--danger",
  shadeRgb: "--shade-rgb",
  sunken: "--sunken",
  sunkenSoft: "--sunken-soft",
  shadow: "--shadow",
  scrim: "--scrim",
  radius: "--radius",
  /* Customer header block (styles/tokens.css). `headerBg` alone turns the
     header into a solid masthead; the rest exist because that block usually
     needs the opposite contrast to the page under it. */
  headerBg: "--header-bg",
  headerInk: "--header-ink",
  headerInkDim: "--header-ink-dim",
  headerInkFaint: "--header-ink-faint",
  headerAccent: "--header-accent",
  headerLine: "--header-line",
  headerSunken: "--header-sunken",
  headerSunkenSoft: "--header-sunken-soft",
};

const FONT_KEY_TO_VAR: Record<string, { cssVar: string; fallback: string }> = {
  fontDisplay: { cssVar: "--font-display", fallback: "cursive" },
  fontBody: { cssVar: "--font-body", fallback: "system-ui, sans-serif" },
};

const SAFE_VALUE = /^[^;{}]*$/;

/** Defaults mirror styles/tokens.css, so a tenant with no font keys still gets the ported look. */
const DEFAULT_DISPLAY_FONT = "Sacramento";
const DEFAULT_BODY_FONT = "Poppins";

/** Only letters, spaces and digits — anything else is not a Google Fonts family name. */
const SAFE_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 ]{0,48}$/;

function familyFromTheme(theme: unknown, key: "fontDisplay" | "fontBody", fallback: string): string {
  const json = (theme && typeof theme === "object" ? theme : {}) as Record<string, unknown>;
  const value = json[key];
  return typeof value === "string" && SAFE_FAMILY.test(value.trim()) ? value.trim() : fallback;
}

/**
 * Loads whichever families `tenants.theme` actually asks for, instead of the
 * hardcoded Poppins+Sacramento pair the port shipped with — a cafe themed onto
 * any other face used to render in the browser's fallback serif.
 *
 * Two separate <link>s, not one combined request: css2 answers 400 for the
 * *whole* stylesheet if any one family/weight pair doesn't exist, so bundling
 * them means one bad name kills both faces. The display family is requested
 * without a weight axis for the same reason — every Google family has a 400,
 * not all of them have 300/500/600/700 (Sacramento has only the one).
 */
export function ThemeFonts({ theme }: { theme: unknown }) {
  const display = familyFromTheme(theme, "fontDisplay", DEFAULT_DISPLAY_FONT);
  const body = familyFromTheme(theme, "fontBody", DEFAULT_BODY_FONT);
  const q = (family: string, axis?: string) =>
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}${axis ?? ""}&display=swap`;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={q(display)} rel="stylesheet" />
      <link href={q(body, ":wght@300;400;500;600;700")} rel="stylesheet" />
    </>
  );
}

/**
 * The three app shells the tokens live on. Must stay in step with the selector
 * list at the top of styles/tokens.css — kept here as a constant so the
 * override can't silently start missing a shell the defaults still cover.
 * `:root ` prefixes each one purely for weight: it makes this rule (0,2,0) beat
 * tokens.css's (0,1,0), so the tenant's palette wins on specificity rather than
 * on whichever stylesheet the bundler happened to emit last.
 */
const SHELL_SELECTOR = [".ordering", ".console", ".kitchen-root"].map((s) => `:root ${s}`).join(",");

/**
 * Injects `tenants.theme` as CSS custom properties from a server component,
 * so there's no colour flash — see plan/BUILD-SPEC.md §7.2. Sanitizes keys
 * against the frozen token list (KEY_TO_VAR) and values against `;`/`{`/`}`
 * before interpolating into a <style> tag.
 */
export function ThemeStyle({ theme }: { theme: unknown }) {
  const json = (theme && typeof theme === "object" ? theme : {}) as Record<string, unknown>;
  const decls: string[] = [];

  for (const [key, cssVar] of Object.entries(KEY_TO_VAR)) {
    const value = json[key];
    if (typeof value === "string" && SAFE_VALUE.test(value)) {
      decls.push(`${cssVar}:${value}`);
    }
  }
  for (const [key, { cssVar, fallback }] of Object.entries(FONT_KEY_TO_VAR)) {
    const value = json[key];
    if (typeof value === "string" && SAFE_VALUE.test(value)) {
      decls.push(`${cssVar}:'${value.replace(/'/g, "")}', ${fallback}`);
    }
  }

  if (!decls.length) return null;
  return <style dangerouslySetInnerHTML={{ __html: `${SHELL_SELECTOR}{${decls.join(";")}}` }} />;
}
