import { DiffLine } from "@/types/pr";

export interface SplitRow {
  id: string;
  type: "context" | "modify" | "addition" | "deletion" | "hunk-header";
  left?: {
    lineNumber?: number;
    content: string;
    type: "context" | "deletion" | "empty";
  };
  right?: {
    lineNumber?: number;
    content: string;
    type: "context" | "addition" | "empty";
  };
}

/**
 * Parses raw unified diff patch text into structured DiffLine objects.
 */
export function parsePatchToLines(patch: string): DiffLine[] {
  if (!patch || !patch.trim()) return [];

  const rawLines = patch.split("\n");
  const result: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const line of rawLines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({
        type: "hunk-header",
        content: line,
      });
    } else if (line.startsWith("-")) {
      result.push({
        type: "deletion",
        oldLineNumber: oldLine++,
        content: line.slice(1),
      });
    } else if (line.startsWith("+")) {
      result.push({
        type: "addition",
        newLineNumber: newLine++,
        content: line.slice(1),
      });
    } else {
      result.push({
        type: "context",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line.startsWith(" ") ? line.slice(1) : line,
      });
    }
  }

  return result;
}

/**
 * Builds synchronized rows for Split (side-by-side) diff mode.
 * Solves the critical row-misalignment bug where deletions and additions
 * would desynchronize row heights across columns.
 */
export function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === "hunk-header") {
      rows.push({
        id: `hunk-${i}`,
        type: "hunk-header",
        left: { content: line.content, type: "empty" },
        right: { content: line.content, type: "empty" },
      });
      i++;
      continue;
    }

    if (line.type === "context") {
      rows.push({
        id: `ctx-${i}-${line.newLineNumber || line.oldLineNumber}`,
        type: "context",
        left: {
          lineNumber: line.oldLineNumber,
          content: line.content,
          type: "context",
        },
        right: {
          lineNumber: line.newLineNumber,
          content: line.content,
          type: "context",
        },
      });
      i++;
      continue;
    }

    // Collect contiguous block of deletions and additions
    const deletions: DiffLine[] = [];
    const additions: DiffLine[] = [];

    while (i < lines.length && (lines[i].type === "deletion" || lines[i].type === "addition")) {
      if (lines[i].type === "deletion") {
        deletions.push(lines[i]);
      } else {
        additions.push(lines[i]);
      }
      i++;
    }

    const maxCount = Math.max(deletions.length, additions.length);
    for (let k = 0; k < maxCount; k++) {
      const del = deletions[k];
      const add = additions[k];
      const rowType = del && add ? "modify" : del ? "deletion" : "addition";

      rows.push({
        id: `diff-${i}-${k}`,
        type: rowType,
        left: del
          ? {
              lineNumber: del.oldLineNumber,
              content: del.content,
              type: "deletion",
            }
          : undefined,
        right: add
          ? {
              lineNumber: add.newLineNumber,
              content: add.content,
              type: "addition",
            }
          : undefined,
      });
    }
  }

  return rows;
}
