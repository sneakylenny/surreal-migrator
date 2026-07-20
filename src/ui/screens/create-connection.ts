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
import {
  createConnection,
  normalizeCreateConnectionInput,
  validateCreateConnectionInput,
  type CreateConnectionInput,
} from "../../core/commands/connection/create.ts";
import { verifyConnectionConnectivity } from "../../core/commands/connection/verify.ts";
import type { MigrationFormat } from "../../core/config.ts";
import {
  formatToPersist,
  migrationFormatOptions,
  tsMigrationsEnabled,
} from "../../core/flags.ts";
import type { AppContext } from "../nav.ts";
import { onKeypress } from "../nav.ts";
import { colors, selectTheme } from "../theme.ts";

type Phase = "form" | "retry" | "default" | "busy";

type Field = {
  label: string;
  input: InputRenderable;
};

export function mountCreateConnectionScreen(ctx: AppContext): void {
  const { renderer } = ctx;
  const config = ctx.getConfig();
  const tsEnabled = tsMigrationsEnabled();

  let phase: Phase = "form";
  let pendingInput: CreateConnectionInput | null = null;
  let focusIndex = 0;
  let unsubscribe: (() => void) | null = null;

  const root = new BoxRenderable(renderer, {
    id: "create-connection-root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 2,
    gap: 1,
    backgroundColor: colors.obsidian,
  });

  const hints = new TextRenderable(renderer, {
    id: "create-connection-hints",
    content: "Tab focus · Enter next/submit · Esc cancel",
    fg: colors.muted,
    flexShrink: 0,
  });

  const title = new TextRenderable(renderer, {
    id: "create-connection-title",
    content: "Add connection",
    fg: colors.pink,
    flexShrink: 0,
  });

  const status = new TextRenderable(renderer, {
    id: "create-connection-status",
    content: "",
    fg: colors.muted,
    flexShrink: 0,
  });

  const scrollBox = new ScrollBoxRenderable(renderer, {
    id: "create-connection-scroll",
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

  const fields: Field[] = [
    makeField("field-name", "Name (kebab-case)", "", "my-connection"),
    makeField(
      "field-endpoint",
      "Endpoint",
      "ws://localhost:8000",
      "ws://localhost:8000",
    ),
    makeField("field-username", "Username", "root", "root"),
    makeField("field-password", "Password", "", ""),
    makeField("field-namespace", "Namespace", "", "main"),
    makeField("field-database", "Database", "", "main"),
    makeField("field-table", "Migration table", "migration", "migration"),
  ];

  let formatSelect: SelectRenderable | null = null;
  let formatValue: MigrationFormat = "surql";

  if (tsEnabled) {
    const formatGroup = new BoxRenderable(renderer, {
      id: "field-format-group",
      width: "100%",
      flexDirection: "column",
      flexShrink: 0,
      gap: 0,
    });
    const formatLabel = new TextRenderable(renderer, {
      id: "field-format-label",
      content: "Migration format",
      fg: colors.pink,
      flexShrink: 0,
    });
    formatSelect = new SelectRenderable(renderer, {
      id: "field-format",
      width: "100%",
      height: 4,
      flexShrink: 0,
      options: migrationFormatOptions(true).map((o) => ({
        name: o.label,
        description: o.hint,
        value: o.value,
      })),
      showDescription: true,
      ...selectTheme,
    });
    formatSelect.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (_i: number, option: SelectOption) => {
        formatValue = option.value as MigrationFormat;
      },
    );
    formatSelect.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_i: number, option: SelectOption) => {
        formatValue = option.value as MigrationFormat;
        void submitForm();
      },
    );
    formatGroup.add(formatLabel);
    formatGroup.add(formatSelect);
    scrollBox.add(formatGroup);
  }

  const overlayBox = new BoxRenderable(renderer, {
    id: "create-connection-overlay",
    width: "100%",
    flexDirection: "column",
    gap: 1,
  });

  root.add(title);
  root.add(scrollBox);
  root.add(status);
  root.add(overlayBox);
  root.add(hints);
  renderer.root.add(root);

  const focusables: Renderable[] = [
    ...fields.map((f) => f.input),
    ...(formatSelect ? [formatSelect] : []),
  ];

  function setStatus(message: string, kind: "muted" | "error" | "success" = "muted") {
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

  function buildInput(): CreateConnectionInput {
    return {
      name: fields[0]!.input.value,
      endpoint: fields[1]!.input.value,
      username: fields[2]!.input.value,
      password: fields[3]!.input.value,
      namespace: fields[4]!.input.value,
      database: fields[5]!.input.value,
      migrationTable: fields[6]!.input.value,
      migrationFormat: formatToPersist(formatValue),
    };
  }

  function clearOverlay() {
    for (const child of [...overlayBox.getChildren()]) {
      child.destroyRecursively();
    }
  }

  function showRetrySelect(error: string, stage: string) {
    phase = "retry";
    clearOverlay();
    setStatus(`${stage} failed: ${error}`, "error");
    const select = new SelectRenderable(renderer, {
      id: "retry-select",
      width: "100%",
      height: 6,
      options: [
        { name: "Retry", description: "Edit details and try again", value: "retry" },
        {
          name: "Continue anyway",
          description: "Save without a verified connection",
          value: "continue",
        },
        { name: "Cancel", description: "Back to connections", value: "cancel" },
      ],
      showDescription: true,
      ...selectTheme,
    });
    select.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_i: number, option: SelectOption) => {
        if (option.value === "cancel") {
          cleanup();
          ctx.showConnections();
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
        void finishWithDefaultPrompt(pendingInput!);
      },
    );
    overlayBox.add(select);
    select.focus();
  }

  function showDefaultSelect(input: CreateConnectionInput) {
    phase = "default";
    clearOverlay();
    setStatus("No default connection yet.");
    const select = new SelectRenderable(renderer, {
      id: "default-select",
      width: "100%",
      height: 5,
      options: [
        {
          name: "Yes",
          description: "Make this the default connection",
          value: true,
        },
        { name: "No", description: "Keep no default for now", value: false },
      ],
      showDescription: true,
      ...selectTheme,
    });
    select.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_i: number, option: SelectOption) => {
        void persist(input, Boolean(option.value));
      },
    );
    overlayBox.add(select);
    select.focus();
  }

  async function persist(input: CreateConnectionInput, makeDefault: boolean) {
    phase = "busy";
    setStatus("Saving…");
    const result = await createConnection(ctx.getConfig(), input, {
      makeDefault,
    });
    if (!result.ok) {
      phase = "form";
      setStatus(result.error, "error");
      focusAt(0);
      return;
    }
    ctx.setConfig(result.config);
    cleanup();
    ctx.showConnections();
  }

  async function finishWithDefaultPrompt(input: CreateConnectionInput) {
    if (!ctx.getConfig().defaultConnection) {
      showDefaultSelect(input);
      return;
    }
    await persist(input, false);
  }

  async function submitForm() {
    if (phase !== "form") return;

    const raw = buildInput();
    const validationError = validateCreateConnectionInput(ctx.getConfig(), raw);
    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    pendingInput = raw;
    phase = "busy";
    setStatus("Verifying connection…");

    const { connection, credentials } = normalizeCreateConnectionInput(raw);
    const verified = await verifyConnectionConnectivity(
      connection,
      credentials,
    );

    if (!verified.ok) {
      showRetrySelect(verified.error, verified.stage);
      return;
    }

    setStatus("Connected.", "success");
    await finishWithDefaultPrompt(raw);
  }

  for (const field of fields) {
    field.input.on(InputRenderableEvents.ENTER, () => {
      if (phase !== "form") return;
      const idx = fields.indexOf(field);
      if (idx < fields.length - 1) {
        focusAt(idx + 1);
        return;
      }
      if (formatSelect) {
        focusAt(fields.length);
        return;
      }
      void submitForm();
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
      cleanup();
      ctx.showConnections();
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
