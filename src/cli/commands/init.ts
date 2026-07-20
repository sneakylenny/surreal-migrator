import { configExists } from "../../core/config.ts";
import { ensureConfig } from "../../core/setup.ts";

export async function runInit(cwd = process.cwd()): Promise<number> {
  const existed = await configExists(cwd);
  await ensureConfig(cwd);
  if (existed) {
    console.log("Config already exists (surreal.config.json).");
  } else {
    console.log("Created surreal.config.json and surreal/ migrations directory.");
  }
  return 0;
}
