// ──────────────────────────────────────────────
// Regex Scripts — Prompt Application
// ──────────────────────────────────────────────
import { applyRegexReplacement } from "@marinara-engine/shared";

type RegexPlacement = "ai_output" | "user_input";

type RegexScriptLike = {
  enabled?: unknown;
  findRegex?: unknown;
  flags?: unknown;
  replaceString?: unknown;
  trimStrings?: unknown;
  placement?: unknown;
  minDepth?: unknown;
  maxDepth?: unknown;
};

export type RegexMessageLike = {
  role: string;
  content: string;
};

function isEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

function parsePlacement(value: unknown): RegexPlacement[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is RegexPlacement => entry === "ai_output" || entry === "user_input");
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsePlacement(parsed);
  } catch {
    return value === "ai_output" || value === "user_input" ? [value] : [];
  }
}

function parseTrimStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function depthValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function applyRegexScriptsToPromptText(
  text: string,
  scripts: RegexScriptLike[],
  placement: RegexPlacement,
  depth: number,
): string {
  let result = text;
  for (const script of scripts) {
    if (!isEnabled(script.enabled)) continue;
    if (!parsePlacement(script.placement).includes(placement)) continue;

    const minDepth = depthValue(script.minDepth);
    const maxDepth = depthValue(script.maxDepth);
    if (minDepth != null && depth < minDepth) continue;
    if (maxDepth != null && depth > maxDepth) continue;

    const findRegex = typeof script.findRegex === "string" ? script.findRegex : "";
    if (!findRegex) continue;

    try {
      const flags = typeof script.flags === "string" ? script.flags : "";
      const replacement = typeof script.replaceString === "string" ? script.replaceString : "";
      const re = new RegExp(findRegex, flags);
      result = applyRegexReplacement(result, re, replacement);
      for (const trim of parseTrimStrings(script.trimStrings)) {
        if (trim) result = result.split(trim).join("");
      }
    } catch {
      /* invalid regex — skip */
    }
  }
  return result;
}

export function applyRegexScriptsToPromptMessages<T extends RegexMessageLike>(
  messages: T[],
  scripts: RegexScriptLike[],
): void {
  if (scripts.length === 0 || messages.length === 0) return;
  const totalMessages = messages.length;
  for (let index = 0; index < totalMessages; index++) {
    const message = messages[index]!;
    const placement = message.role === "user" ? "user_input" : "ai_output";
    const depth = totalMessages - 1 - index;
    message.content = applyRegexScriptsToPromptText(message.content, scripts, placement, depth);
  }
}
