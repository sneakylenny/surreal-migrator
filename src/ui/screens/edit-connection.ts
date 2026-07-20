import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type Renderable,
  type SelectOption,
} from "@opentui/core";
import { normalizeCreateConnectionInput } from "../../core/commands/connection/create.ts";
import {
  updateConnection,
  validateUpdateConnectionInput,
  type UpdateConnectionInput,
} from "../../core/commands/connection/update.ts";
import { verifyConnectionConnectivity } from "../../core/commands/connection/verify.ts";
import {
  findConnection,
  resolveMigrationFormat,
  type MigrationFormat,
} from "../../core/config.ts";
import { getConnectionCredentials } from "../../core/env.ts";
import {
  formatToPersist,
  migrationFormatOptions,
  tsMigrationsEnabled,
} from "../../core/flags.ts";
import { createScreenShell } from "../layout.ts";
import type { AppContext } from "../nav.ts";
import { onKeypress } from "../nav.ts";
import { colors, selectTheme } from "../theme.ts";

type Phase = "form" | "retry" | "busy";

type Field = {
  label: string;
  input: InputRenderable;
};

export function mountEditConnectionScreen(
  ctx: AppContext,
  connectionName: string,
): void {
  const { renderer } = ctx;
  const config = ctx.getConfig();
  const connection = findConnection(config, connectionName);

  if (!connection) {
    ctx.showConnections();
    return;
  }

  // Narrow for nested async/closures (TS does not retain the guard there).
  const existing: NonNullable<typeof connection> = connection;
  const creds = getConnectionCredentials(existing.name);
  const tsEnabled = tsMigrationsEnabled();
  const currentFormat = resolveMigrationFormat(config, existing);
  const wasDefault = config.defaultConnection === existing.name;

  let phase: Phase = "form";
  let pendingInput: UpdateConnectionInput | null = null;
  let focusIndex = 0;
  let unsubscribe: (() => void) | null = null;
  let formatValue: MigrationFormat = currentFormat;
  let makeDefault = wasDefault;

  const { root, content } = createScreenShell(
    renderer,
    ["connections", existing.name, "edit"],
    "edit-connection",
  );

  const hints = new TextRenderable(renderer, {
    id: "edit-connection-hints",
    content: "Tab focus · Enter next/submit · Esc cancel",
    fg: colors.muted,
    flexShrink: 0,
  });

  const status = new TextRenderable(renderer, {
    id: "edit-connection-status",
    content: "",
    fg: colors.muted,
    flexShrink: 0,
  });

  const scrollBox = new ScrollBoxRenderable(renderer, {
    id: "edit-connection-scroll",
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    scrollX: false,
    scrollY: true,
    stickyScroll: false,
    rootOptions: { backgroundColor: colors.obsidian },
    wrapperOptions: { backgroundColor: colors.obsidian },
    viewportOptions: { backgroundColor: colors.obsidian },
    contentOptions: {
      backgroundColor: colors.obsidian,
      flexDirection: "column",
      gap: 1,
    },
    scrollbarOptions: {
      trackOptions: {
        foregroundColor: colors.purple,
        backgroundColor: colors.lavender,
      },
    },
  });

  function makeField(
    id: string,
    label: string,
    value: string,
    placeholder: string,
  ): Field {
    const group = new BoxRenderable(renderer, {
      id: `${id}-group`,
      width: "100%",
      flexDirection: "column",
      flexShrink: 0,
      gap: 0,
    });
    const labelText = new TextRenderable(renderer, {
      id: `${id}-label`,
      content: label,
      fg: colors.pink,
      flexShrink: 0,
    });
    const input = new InputRenderable(renderer, {
      id,
      width: "100%",
      value,
      placeholder,
      flexShrink: 0,
      backgroundColor: colors.lavender,
      focusedBackgroundColor: colors.purple,
      textColor: colors.moonlit,
      focusedTextColor: colors.moonlit,
      cursorColor: colors.pink,
    });
    group.add(labelText);
    group.add(input);
    scrollBox.add(group);
    return { label, input };
  }

  const nameNote = new TextRenderable(renderer, {
    id: "edit-connection-name",
    content: `Name: ${existing.name} (fixed)`,
    fg: colors.muted,
    flexShrink: 0,
  });
  scrollBox.add(nameNote);

  const fields: Field[] = [
    makeField(
      "edit-endpoint",
      "Endpoint",
      existing.endpoint,
      "ws://localhost:8000",
    ),
    makeField(
      "edit-username",
      "Username",
      creds.username ?? "root",
      "root",
    ),
    makeField("edit-password", "Password", creds.password ?? "", ""),
    makeField("edit-namespace", "Namespace", existing.namespace, "main"),
    makeField("edit-database", "Database", existing.database, "main"),
    makeField(
      "edit-table",
      "Migration table",
      existing.migrationTable,
      "migration",
    ),
  ];

  let formatSelect: SelectRenderable | null = null;
  if (tsEnabled) {
    const formatGroup = new BoxRenderable(renderer, {
      id: "edit-format-group",
      width: "100%",
      flexDirection: "column",
      flexShrink: 0,
      gap: 0,
    });
    formatGroup.add(
      new TextRenderable(renderer, {
        id: "edit-format-label",
        content: "Migration format",
        fg: colors.pink,
        flexShrink: 0,
      }),
    );
    const formatOptions = migrationFormatOptions(true);
    formatSelect = new SelectRenderable(renderer, {
      id: "edit-format",
      width: "100%",
      height: 4,
      flexShrink: 0,
      options: formatOptions.map((o) => ({
        name: o.label,
        description: o.hint,
        value: o.value,
      })),
      selectedIndex: formatOptions.findIndex((o) => o.value === currentFormat),
      showDescription: true,
      ...selectTheme,
    });
    formatSelect.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (_i: number, option: SelectOption) => {
        formatValue = option.value as MigrationFormat;
      },
    );
    formatGroup.add(formatSelect);
    scrollBox.add(formatGroup);
  }

  const defaultGroup = new BoxRenderable(renderer, {
    id: "edit-default-group",
    width: "100%",
    flexDirection: "column",
    flexShrink: 0,
    gap: 0,
  });
  defaultGroup.add(
    new TextRenderable(renderer, {
      id: "edit-default-label",
      content: "Default connection",
      fg: colors.pink,
      flexShrink: 0,
    }),
  );
  const defaultSelect = new SelectRenderable(renderer, {
    id: "edit-default",
    width: "100%",
    height: 4,
    flexShrink: 0,
    options: [
      {
        name: "Yes",
        description: "Use this as the default connection",
        value: true,
      },
      {
        name: "No",
        description: wasDefault
          ? "Clear default for this connection"
          : "Leave the current default unchanged",
        value: false,
      },
    ],
    selectedIndex: wasDefault ? 0 : 1,
    showDescription: true,
    ...selectTheme,
  });
  defaultSelect.on(
    SelectRenderableEvents.SELECTION_CHANGED,
    (_i: number, option: SelectOption) => {
      makeDefault = Boolean(option.value);
    },
  );
  defaultSelect.on(
    SelectRenderableEvents.ITEM_SELECTED,
    (_i: number, option: SelectOption) => {
      makeDefault = Boolean(option.value);
      void submitForm();
    },
  );
  defaultGroup.add(defaultSelect);
  scrollBox.add(defaultGroup);

  const overlayBox = new BoxRenderable(renderer, {
    id: "edit-connection-overlay",
    width: "100%",
    flexDirection: "column",
    gap: 1,
  });

  content.add(scrollBox);
  content.add(status);
  content.add(overlayBox);
  content.add(hints);
  renderer.root.add(root);

  const focusables: Renderable[] = [
    ...fields.map((f) => f.input),
    ...(formatSelect ? [formatSelect] : []),
    defaultSelect,
  ];

  function setStatus(
    message: string,
    kind: "muted" | "error" | "success" = "muted",
  ) {
    status.content = message;
    status.fg =
      kind === "error"
        ? "#ef4444"
        : kind === "success"
          ? colors.success
          : colors.muted;
  }

  function focusAt(index: number) {
    focusIndex = (index + focusables.length) % focusables.length;
    const target = focusables[focusIndex];
    if (!target) return;
    target.focus();
    scrollBox.scrollChildIntoView(target.id);
  }

  function buildInput(): UpdateConnectionInput {
    return {
      endpoint: fields[0]!.input.value,
      username: fields[1]!.input.value,
      password: fields[2]!.input.value,
      namespace: fields[3]!.input.value,
      database: fields[4]!.input.value,
      migrationTable: fields[5]!.input.value,
      migrationFormat: formatToPersist(formatValue),
    };
  }

  function clearOverlay() {
    for (const child of [...overlayBox.getChildren()]) {
      child.destroyRecursively();
    }
  }

  function goBack() {
    cleanup();
    ctx.showConnection(existing.name);
  }

  function showRetrySelect(error: string, stage: string) {
    phase = "retry";
    clearOverlay();
    setStatus(`${stage} failed: ${error}`, "error");
    const select = new SelectRenderable(renderer, {
      id: "edit-retry-select",
      width: "100%",
      height: 6,
      options: [
        { name: "Retry", description: "Edit details and try again", value: "retry" },
        {
          name: "Save anyway",
          description: "Save without a verified connection",
          value: "continue",
        },
        { name: "Cancel", description: "Back to connection", value: "cancel" },
      ],
      showDescription: true,
      ...selectTheme,
    });
    select.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_i: number, option: SelectOption) => {
        if (option.value === "cancel") {
          goBack();
          return;
        }
        if (option.value === "retry") {
          clearOverlay();
          phase = "form";
          setStatus("");
          focusAt(0);
          return;
        }
        clearOverlay();
        void persist(pendingInput!);
      },
    );
    overlayBox.add(select);
    select.focus();
  }

  async function persist(input: UpdateConnectionInput) {
    phase = "busy";
    setStatus("Saving…");
    const result = await updateConnection(ctx.getConfig(), existing.name, input, {
      makeDefault,
    });
    if (!result.ok) {
      phase = "form";
      setStatus(result.error, "error");
      focusAt(0);
      return;
    }
    ctx.setConfig(result.config);
    ctx.sessionLog.add({
      kind: "updated_connection",
      name: existing.name,
    });
    cleanup();
    ctx.showConnection(existing.name);
  }

  async function submitForm() {
    if (phase !== "form") return;

    const raw = buildInput();
    const validationError = validateUpdateConnectionInput(
      ctx.getConfig(),
      existing.name,
      raw,
    );
    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    pendingInput = raw;
    phase = "busy";
    setStatus("Verifying connection…");

    const { connection: normalized, credentials } =
      normalizeCreateConnectionInput({
        name: existing.name,
        ...raw,
      });
    const verified = await verifyConnectionConnectivity(
      normalized,
      credentials,
    );

    if (!verified.ok) {
      showRetrySelect(verified.error, verified.stage);
      return;
    }

    setStatus("Connected.", "success");
    await persist(raw);
  }

  for (const field of fields) {
    field.input.on(InputRenderableEvents.ENTER, () => {
      if (phase !== "form") return;
      const idx = fields.indexOf(field);
      if (idx < fields.length - 1) {
        focusAt(idx + 1);
        return;
      }
      focusAt(fields.length);
    });
  }

  function cleanup() {
    unsubscribe?.();
    unsubscribe = null;
  }

  unsubscribe = onKeypress(renderer, (key) => {
    if (key.name === "escape") {
      key.preventDefault();
      if (phase === "busy") return;
      goBack();
      return;
    }

    if (phase !== "form") return;

    if (key.name === "tab") {
      key.preventDefault();
      focusAt(focusIndex + (key.shift ? -1 : 1));
    }
  });

  focusAt(0);
}
