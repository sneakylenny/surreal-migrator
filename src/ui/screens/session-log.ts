import {
  ScrollBoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { createScreenShell } from "../layout.ts";
import type { AppContext } from "../nav.ts";
import { onKeypress } from "../nav.ts";
import { formatSessionSummary } from "../session-log.ts";
import { colors } from "../theme.ts";

export function mountSessionLogScreen(ctx: AppContext): void {
  const { renderer } = ctx;

  const { root, content } = createScreenShell(
    renderer,
    ["session"],
    "session-log",
  );

  const scrollBox = new ScrollBoxRenderable(renderer, {
    id: "session-log-scroll",
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
      gap: 0,
    },
    scrollbarOptions: {
      trackOptions: {
        foregroundColor: colors.purple,
        backgroundColor: colors.lavender,
      },
    },
  });

  const lines = formatSessionSummary(ctx.sessionLog.events);
  for (const [index, line] of lines.entries()) {
    const isTitle = index === 0 && ctx.sessionLog.events.length > 0;
    scrollBox.add(
      new TextRenderable(renderer, {
        id: `session-log-line-${index}`,
        content: line.length === 0 ? " " : line,
        fg: isTitle
          ? colors.pink
          : line.startsWith("•")
            ? colors.moonlit
            : colors.muted,
        flexShrink: 0,
      }),
    );
  }

  const hints = new TextRenderable(renderer, {
    id: "session-log-hints",
    content: "Esc back",
    fg: colors.muted,
    flexShrink: 0,
  });

  const unsubscribe = onKeypress(renderer, (key) => {
    if (key.name !== "escape") return;
    key.preventDefault();
    unsubscribe();
    ctx.showConnections();
  });

  content.add(scrollBox);
  content.add(hints);
  renderer.root.add(root);
}
