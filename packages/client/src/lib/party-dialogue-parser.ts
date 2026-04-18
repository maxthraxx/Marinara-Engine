// ──────────────────────────────────────────────
// Party Dialogue Parser
//
// Parses structured party response lines into
// typed dialogue lines for the narration system.
//
// Format:
//   [Name] [main] [expression]: "Dialogue text here."
//   [Name] [side] [expression]: "Side remark text."
//   [Name] [action] [expression]: Description of action.
//   [Name] [thought] [expression]: Internal monologue text.
//   [Name] [whisper:Target] [expression]: "Whispered text."
//   [Name] [react] [expression]: *expression/gesture*
//   Expression tag is optional — lines without it still parse.
// ──────────────────────────────────────────────

import type { PartyDialogueLine, PartyDialogueType } from "@marinara-engine/shared";

const VALID_TYPES = new Set<PartyDialogueType>(["main", "side", "extra", "action", "thought", "whisper"]);

/**
 * Parse a single line of party dialogue.
 *
 * Matches: [CharName] [type] [expression]: content
 *     or:  [CharName] [type]: content  (expression optional)
 *     or:  [CharName] [whisper:TargetName] [expression]: content
 */
const PARTY_LINE_RE =
  /^\s*\[([^\]]+)\]\s*\[(main|side|extra|action|thought|whisper(?::([^\]]+))?)]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;

export function parsePartyDialogue(raw: string): PartyDialogueLine[] {
  const lines = raw.split(/\r?\n/);
  const result: PartyDialogueLine[] = [];
  let skipped = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(PARTY_LINE_RE);
    if (!match) {
      skipped++;
      continue;
    }

    const character = match[1]!.trim();
    const rawType = match[2]!.toLowerCase().replace(/:.*$/, ""); // strip :Target from whisper:Target
    const target = match[3]?.trim() || undefined;
    const expression = match[4]?.trim() || undefined;
    let content = match[5]!.trim();

    if (!VALID_TYPES.has(rawType as PartyDialogueType)) continue;

    // Strip surrounding quotes if present (for main/side/extra/whisper dialogue)
    if (
      (rawType === "main" || rawType === "side" || rawType === "extra" || rawType === "whisper") &&
      content.length >= 2
    ) {
      if (
        (content.startsWith('"') && content.endsWith('"')) ||
        (content.startsWith("\u201c") && content.endsWith("\u201d")) ||
        (content.startsWith("\u00ab") && content.endsWith("\u00bb"))
      ) {
        content = content.slice(1, -1);
      }
    }

    result.push({
      character,
      type: rawType as PartyDialogueType,
      content,
      ...(target ? { target } : {}),
      ...(expression ? { expression } : {}),
    });
  }

  if (skipped > 0) {
    console.warn(`[party-dialogue-parser] Skipped ${skipped} non-matching line(s) from party response`);
  }

  return result;
}
