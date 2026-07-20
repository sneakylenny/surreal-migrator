export type SessionEvent =
  | { kind: "opened_connection"; at: number; name: string }
  | { kind: "created_connection"; at: number; name: string }
  | { kind: "updated_connection"; at: number; name: string }
  | {
      kind: "created_migration";
      at: number;
      connection: string;
      files: string[];
    }
  | {
      kind: "migrated";
      at: number;
      connection: string;
      ids: string[];
    }
  | {
      kind: "rolled_back";
      at: number;
      connection: string;
      ids: string[];
      skipped?: string[];
    }
  | {
      kind: "deleted_record";
      at: number;
      connection: string;
      id: string;
    }
  | {
      kind: "failed";
      at: number;
      /** Short verb phrase, e.g. "roll back" / "migrate". */
      action: string;
      error: string;
    };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type SessionEventInput = DistributiveOmit<SessionEvent, "at"> & {
  at?: number;
};

export type SessionLog = {
  events: SessionEvent[];
  add: (event: SessionEventInput) => void;
  clear: () => void;
};

/** Join ids as "a", "a and b", or "a, b, and c". */
export function formatIdList(ids: string[]): string {
  if (ids.length === 0) return "nothing";
  if (ids.length === 1) return ids[0]!;
  if (ids.length === 2) return `${ids[0]} and ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")}, and ${ids[ids.length - 1]}`;
}

export function formatSessionEvent(event: SessionEvent): string {
  switch (event.kind) {
    case "opened_connection":
      return `Opened connection ${event.name}`;
    case "created_connection":
      return `Created connection ${event.name}`;
    case "updated_connection":
      return `Updated connection ${event.name}`;
    case "created_migration":
      return event.files.length === 1
        ? `Created migration ${event.files[0]}`
        : `Created migration files ${formatIdList(event.files)}`;
    case "migrated":
      return `Migrated ${formatIdList(event.ids)}`;
    case "rolled_back": {
      const base = `Rolled back ${formatIdList(event.ids)}`;
      if (event.skipped && event.skipped.length > 0) {
        return `${base} (skipped missing source: ${formatIdList(event.skipped)})`;
      }
      return base;
    }
    case "deleted_record":
      return `Deleted migration record ${event.id}`;
    case "failed":
      return `Tried to ${event.action} but failed:\n  ${event.error}`;
  }
}

/** Lines for one event (failed actions span two lines). */
export function formatSessionEventLines(event: SessionEvent): string[] {
  if (event.kind === "failed") {
    return [
      `• Tried to ${event.action} but failed:`,
      `  ${event.error}`,
    ];
  }
  return [`• ${formatSessionEvent(event)}`];
}

/** Multi-line summary for the session activity screen / exit printout. */
export function formatSessionSummary(events: SessionEvent[]): string[] {
  if (events.length === 0) {
    return ["No activity yet this session."];
  }

  const lines: string[] = [
    `Session activity (${events.length} event${events.length === 1 ? "" : "s"})`,
    "",
  ];

  for (const event of events) {
    lines.push(...formatSessionEventLines(event));
  }

  return lines;
}

/** Print the session summary to stdout after the TUI exits. Skips if empty. */
export function printSessionSummary(log: SessionLog): void {
  if (log.events.length === 0) return;
  console.log("");
  for (const line of formatSessionSummary(log.events)) {
    console.log(line);
  }
  console.log("");
}

export function createSessionLog(): SessionLog {
  const events: SessionEvent[] = [];
  return {
    events,
    add(event) {
      events.push({ ...event, at: event.at ?? Date.now() } as SessionEvent);
    },
    clear() {
      events.length = 0;
    },
  };
}
