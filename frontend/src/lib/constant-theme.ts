// NOTE: There’s a separate THEMES array in @/lib/util-theme for pre-hydration
// Changes here should be mirrored there.
export const THEMES = [
    "light",
    "dark",
    "sand",
    "minimal",
    "monolith",
    "rewaff",
    "rewaff-dark",
    "tealish",
    "tealish-dark",
    "brutalist",
] as const;

export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "light";
