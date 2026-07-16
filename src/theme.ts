import pc from "picocolors";

/** Official SurrealDB brand colours — https://surrealdb.com/brand */
export const colors = {
  pink: "#D255FE",
  purple: "#651DDD",
  lavender: "#242133",
  obsidian: "#0E0C14",
  moonlit: "#F9F9F9",
} as const;

function rgb(hex: string, text: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

export const theme = {
  title: (text: string) => pc.bold(rgb(colors.pink, text)),
  accent: (text: string) => rgb(colors.pink, text),
  purple: (text: string) => rgb(colors.purple, text),
  muted: (text: string) => pc.dim(text),
  success: (text: string) => pc.green(text),
  error: (text: string) => pc.red(text),
  hint: (text: string) => pc.dim(text),
  label: (text: string) => rgb(colors.pink, text),
};
