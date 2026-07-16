import * as p from "@clack/prompts";
import {
  connectionExists,
  findConnection,
  isValidKebabCase,
  saveConfig,
  type Config,
  type Connection,
} from "../config.ts";
import { verifyConnection } from "../db.ts";
import { saveConnectionCredentials } from "../env.ts";
import { theme } from "../theme.ts";
import { showConnectionMenu } from "./connection.ts";

const ADD = "__add__";
const QUIT = "__quit__";

export async function showConnectionsMenu(config: Config): Promise<void> {
  let current = config;

  while (true) {
    const options = [
      ...current.connections.map((c) => ({
        value: c.name,
        label:
          current.defaultConnection === c.name
            ? `${c.name} (default)`
            : c.name,
        hint: `${c.endpoint} · ${c.namespace} / ${c.database}`,
      })),
      { value: ADD, label: "Add connection" },
      { value: QUIT, label: "Quit" },
    ];

    const selected = await p.select({
      message: current.connections.length
        ? "Select a connection"
        : "No connections yet — add one to get started",
      options,
    });

    if (p.isCancel(selected) || selected === QUIT) {
      p.outro(theme.muted("Goodbye."));
      return;
    }

    if (selected === ADD) {
      current = await addConnection(current);
      continue;
    }

    const connection = findConnection(current, selected);
    if (!connection) {
      p.log.error(theme.error(`Connection "${selected}" not found.`));
      continue;
    }

    const result = await showConnectionMenu(current, connection);
    current = result.config;
    if (result.status === "quit") {
      p.outro(theme.muted("Goodbye."));
      return;
    }
  }
}

async function addConnection(config: Config): Promise<Config> {
  while (true) {
    const name = await p.text({
      message: "Connection name (kebab-case)",
      placeholder: "my-connection",
      validate: (value) => {
        const trimmed = (value ?? "").trim();
        if (!trimmed) return "Name is required";
        if (!isValidKebabCase(trimmed)) {
          return "Use kebab-case (e.g. my-connection)";
        }
        if (connectionExists(config, trimmed)) {
          return `Connection "${trimmed}" already exists`;
        }
      },
    });
    if (p.isCancel(name)) return config;

    const endpoint = await p.text({
      message: "Endpoint",
      placeholder: "ws://localhost:8000",
      defaultValue: "ws://localhost:8000",
      initialValue: "ws://localhost:8000",
    });
    if (p.isCancel(endpoint)) return config;

    const username = await p.text({
      message: "Username",
      placeholder: "root",
      defaultValue: "root",
      initialValue: "root",
    });
    if (p.isCancel(username)) return config;

    const password = await p.password({
      message: "Password (leave empty for root)",
    });
    if (p.isCancel(password)) return config;

    const namespace = await p.text({
      message: "Namespace",
      placeholder: "app",
      validate: (value) =>
        !(value ?? "").trim() ? "Namespace is required" : undefined,
    });
    if (p.isCancel(namespace)) return config;

    const database = await p.text({
      message: "Database",
      placeholder: "main",
      validate: (value) =>
        !(value ?? "").trim() ? "Database is required" : undefined,
    });
    if (p.isCancel(database)) return config;

    const connection: Connection = {
      name: name.trim(),
      endpoint: endpoint.trim() || "ws://localhost:8000",
      namespace: namespace.trim(),
      database: database.trim(),
    };

    const credentials = {
      username: username.trim() || "root",
      password: password || "root",
    };

    const spin = p.spinner();
    spin.start("Verifying connection…");
    const result = await verifyConnection(connection, credentials);

    if (result.ok) {
      spin.stop(theme.success("Connected successfully"));
    } else {
      spin.stop(theme.error("Connection failed"));
      p.log.error(theme.error(result.error));

      const next = await p.select({
        message: "What next?",
        options: [
          { value: "retry", label: "Retry" },
          { value: "continue", label: "Continue anyway" },
          { value: "cancel", label: "Cancel" },
        ],
      });

      if (p.isCancel(next) || next === "cancel") return config;
      if (next === "retry") continue;
    }

    await saveConnectionCredentials(connection.name, credentials);

    let nextConfig: Config = {
      ...config,
      connections: [...config.connections, connection],
    };

    if (!nextConfig.defaultConnection) {
      const makeDefault = await p.confirm({
        message: "Make this the default connection?",
        initialValue: true,
      });

      if (!p.isCancel(makeDefault) && makeDefault) {
        nextConfig = { ...nextConfig, defaultConnection: connection.name };
      }
    }

    await saveConfig(nextConfig);
    p.log.success(theme.success(`Saved connection "${connection.name}"`));
    return nextConfig;
  }
}
