import path from "node:path";

const ENV_FILENAME = ".env";

/** `my-connection` → `MY_CONNECTION` */
export function connectionEnvSegment(name: string): string {
  return name.replace(/-/g, "_").toUpperCase();
}

/** `SURREAL_<CONNECTION>_<KEY>` e.g. `SURREAL_MY_CONNECTION_USERNAME` */
export function connectionEnvKey(connectionName: string, key: string): string {
  return `SURREAL_${connectionEnvSegment(connectionName)}_${key.toUpperCase()}`;
}

export type ConnectionCredentials = {
  username: string;
  password: string;
};

export function getConnectionCredentials(
  connectionName: string,
): Partial<ConnectionCredentials> {
  return {
    username: process.env[connectionEnvKey(connectionName, "USERNAME")],
    password: process.env[connectionEnvKey(connectionName, "PASSWORD")],
  };
}

function envPath(cwd = process.cwd()): string {
  return path.join(cwd, ENV_FILENAME);
}

async function readEnvFile(cwd = process.cwd()): Promise<string> {
  const file = Bun.file(envPath(cwd));
  if (!(await file.exists())) return "";
  return await file.text();
}

/**
 * Upsert key=value lines in `.env` without clobbering unrelated keys.
 * Also updates `process.env` for the current session.
 */
export async function upsertEnvVars(
  vars: Record<string, string>,
  cwd = process.cwd(),
): Promise<void> {
  let content = await readEnvFile(cwd);
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];

  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
    const entry = `${key}=${value}`;
    const index = lines.findIndex((line) => {
      const trimmed = line.trim();
      return trimmed.startsWith(`${key}=`) || trimmed.startsWith(`${key} =`);
    });
    if (index >= 0) {
      lines[index] = entry;
    } else {
      if (lines.length > 0 && lines[lines.length - 1] !== "") {
        lines.push(entry);
      } else if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines[lines.length - 1] = entry;
        lines.push("");
      } else {
        lines.push(entry);
      }
    }
  }

  let next = lines.join("\n");
  if (!next.endsWith("\n")) next += "\n";
  await Bun.write(envPath(cwd), next);
}

export async function saveConnectionCredentials(
  connectionName: string,
  credentials: ConnectionCredentials,
  cwd = process.cwd(),
): Promise<void> {
  await upsertEnvVars(
    {
      [connectionEnvKey(connectionName, "USERNAME")]: credentials.username,
      [connectionEnvKey(connectionName, "PASSWORD")]: credentials.password,
    },
    cwd,
  );
}
