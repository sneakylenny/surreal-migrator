/** Official SurrealDB brand colours — https://surrealdb.com/brand */
export const colors = {
  pink: "#D255FE",
  purple: "#651DDD",
  lavender: "#242133",
  obsidian: "#0E0C14",
  moonlit: "#F9F9F9",
  muted: "#888888",
  success: "#22c55e",
} as const;

export const selectTheme = {
  backgroundColor: colors.obsidian,
  textColor: colors.moonlit,
  focusedBackgroundColor: colors.lavender,
  focusedTextColor: colors.moonlit,
  selectedBackgroundColor: colors.purple,
  selectedTextColor: colors.moonlit,
  descriptionColor: colors.muted,
  selectedDescriptionColor: "#CCCCCC",
} as const;
