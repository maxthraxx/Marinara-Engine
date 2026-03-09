// ──────────────────────────────────────────────
// Hook: Apply Regex Scripts to text
// ──────────────────────────────────────────────
import { useCallback, useMemo } from "react";
import { useRegexScripts, type RegexScriptRow } from "./use-regex-scripts";
import type { RegexPlacement } from "@marinara-engine/shared";

/**
 * Parses a RegexScriptRow from DB into a usable form.
 */
function parseScript(row: RegexScriptRow) {
  const placements: RegexPlacement[] = (() => {
    try {
      return JSON.parse(row.placement);
    } catch {
      return ["ai_output"];
    }
  })();
  const trimStrings: string[] = (() => {
    try {
      return JSON.parse(row.trimStrings);
    } catch {
      return [];
    }
  })();
  return {
    ...row,
    enabledBool: row.enabled === "true",
    promptOnlyBool: row.promptOnly === "true",
    placements,
    trimStrings,
  };
}

/**
 * Applies all enabled regex scripts for a given placement to the input text.
 */
function applyScripts(
  text: string,
  scripts: ReturnType<typeof parseScript>[],
  placement: RegexPlacement,
  options?: { promptOnly?: boolean },
): string {
  let result = text;
  for (const script of scripts) {
    if (!script.enabledBool) continue;
    if (!script.placements.includes(placement)) continue;
    // If we're rendering display text and script is prompt-only, skip
    if (!options?.promptOnly && script.promptOnlyBool) continue;

    try {
      const re = new RegExp(script.findRegex, script.flags);
      result = result.replace(re, script.replaceString);
      // Apply trim strings
      for (const trim of script.trimStrings) {
        if (trim) result = result.split(trim).join("");
      }
    } catch {
      // Invalid regex — skip silently
    }
  }
  return result;
}

/**
 * Hook that provides functions to apply regex transformations.
 *
 * Usage:
 *   const { applyToAIOutput, applyToUserInput } = useApplyRegex();
 *   const displayText = applyToAIOutput(message.content);
 */
export function useApplyRegex() {
  const { data: regexScripts } = useRegexScripts();

  // Pre-parse all scripts (sorted by order, which is done server-side)
  const parsedScripts = useMemo(() => {
    if (!regexScripts) return [];
    return (regexScripts as RegexScriptRow[]).map(parseScript);
  }, [regexScripts]);

  const applyToAIOutput = useCallback(
    (text: string) => applyScripts(text, parsedScripts, "ai_output"),
    [parsedScripts],
  );

  const applyToUserInput = useCallback(
    (text: string) => applyScripts(text, parsedScripts, "user_input"),
    [parsedScripts],
  );

  return { applyToAIOutput, applyToUserInput };
}
