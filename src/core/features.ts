import type { MigrationFormat } from "./config.ts";

declare const __SM_TS_MIGRATIONS__: boolean;

/** True unless compiled with --define __SM_TS_MIGRATIONS__=false */
export function tsMigrationsEnabled(): boolean {
  return typeof __SM_TS_MIGRATIONS__ === "undefined"
    ? true
    : __SM_TS_MIGRATIONS__;
}

export type FormatSelectOption = {
  value: MigrationFormat;
  label: string;
  hint: string;
};

/** SurQL always; TypeScript only when the feature flag is on. */
export function migrationFormatOptions(
  tsEnabled = tsMigrationsEnabled(),
): FormatSelectOption[] {
  const options: FormatSelectOption[] = [
    {
      value: "surql",
      label: "Split SurQL",
      hint: ".up.surql and .down.surql",
    },
  ];
  if (tsEnabled) {
    options.push({
      value: "ts",
      label: "TypeScript",
      hint: "single file with up/down functions",
    });
  }
  return options;
}

/** Error message if format is not allowed in this build; otherwise null. */
export function assertFormatSupported(
  format: MigrationFormat,
  tsEnabled = tsMigrationsEnabled(),
): string | null {
  if (format === "ts" && !tsEnabled) {
    return "TypeScript migrations are not supported in this build. Use SurQL (.up.surql / .down.surql) or run via Bun from source.";
  }
  return null;
}

/**
 * Value to persist on a connection.
 * SurQL is implied by omitting the field — only store `"ts"` explicitly.
 */
export function formatToPersist(
  format: MigrationFormat,
): MigrationFormat | null {
  return format === "ts" ? "ts" : null;
}
