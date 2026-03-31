// ──────────────────────────────────────────────
// Importer: SillyTavern Character (JSON / V2 Card / CharX)
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { importSTLorebook } from "./st-lorebook.importer.js";
import type { CharacterData } from "@marinara-engine/shared";
import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { DATA_DIR } from "../../utils/data-dir.js";
import AdmZip from "adm-zip";

const AVATAR_DIR = join(DATA_DIR, "avatars");

function ensureAvatarDir() {
  if (!existsSync(AVATAR_DIR)) {
    mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

/**
 * Import a SillyTavern character card (JSON format).
 * Handles V1, V2, Pygmalion, and RisuAI formats.
 * If _avatarDataUrl is present, saves the avatar image.
 */
export async function importSTCharacter(raw: Record<string, unknown>, db: DB) {
  const storage = createCharactersStorage(db);

  // Extract avatar data URL if present (from PNG import)
  const avatarDataUrl = raw._avatarDataUrl as string | null;
  delete raw._avatarDataUrl;

  // Extract browser source marker if present
  const botBrowserSource = raw._botBrowserSource as string | null;
  delete raw._botBrowserSource;

  let data: CharacterData;

  // Detect format
  if ((raw.spec === "chara_card_v2" || raw.spec === "chara_card_v3") && raw.data) {
    // V2 / V3 format — extract from data wrapper
    data = normalizeV2(raw.data as Record<string, unknown>);
  } else if (raw.char_name || raw.name) {
    // V1 / Pygmalion format — convert to V2
    data = convertV1toV2(raw);
  } else if (raw.type === "character" && raw.data) {
    // RisuAI format
    data = convertRisuToV2((raw.data as Record<string, unknown>) ?? {});
  } else {
    // Try treating the whole object as character data
    data = normalizeV2(raw);
  }

  // Tag with browser source if imported from browser
  if (botBrowserSource) {
    data.extensions.botBrowserSource = botBrowserSource;
  }

  // Save avatar image if provided
  let avatarPath: string | undefined;
  if (avatarDataUrl && avatarDataUrl.startsWith("data:image/")) {
    ensureAvatarDir();
    const ext = avatarDataUrl.match(/^data:image\/([\w+]+);/)?.[1]?.replace("+xml", "") ?? "png";
    const filename = `${randomUUID()}.${ext}`;
    const filePath = join(AVATAR_DIR, filename);

    // Strip data URL header → raw base64
    const base64 = avatarDataUrl.split(",")[1];
    if (base64) {
      await writeFile(filePath, Buffer.from(base64, "base64"));
      avatarPath = `/api/avatars/file/${filename}`;
    }
  }

  const character = await storage.create(data, avatarPath);
  const charId = (character as { id?: string } | null)?.id;

  // Extract character_book into a standalone lorebook linked to this character
  let lorebookResult: { lorebookId?: string; entriesImported?: number } | null = null;
  if (data.character_book && charId) {
    const bookRaw = data.character_book as unknown as Record<string, unknown>;
    // ST character_book uses the same shape as World Info
    const wiData: Record<string, unknown> = {
      name: `${data.name}'s Lorebook`,
      entries: bookRaw.entries ?? {},
      extensions: bookRaw.extensions ?? {},
    };

    try {
      const result = await importSTLorebook(wiData, db, {
        characterId: charId,
        namePrefix: data.name,
      });
      if (result && "lorebookId" in result) {
        lorebookResult = {
          lorebookId: result.lorebookId as string,
          entriesImported: result.entriesImported as number,
        };
      }
    } catch {
      // Non-fatal — character was imported, just lorebook extraction failed
    }
  }

  return {
    success: true,
    characterId: charId,
    name: data.name,
    ...(lorebookResult ? { lorebook: lorebookResult } : {}),
  };
}

/**
 * Import a CharX (.charx) file — RisuAI Character Card V3 zip format.
 * Extracts card.json and the main icon asset from the zip.
 */
export async function importCharX(buf: Buffer, db: DB) {
  const zip = new AdmZip(buf);

  // Extract card.json from root of the zip
  const cardEntry = zip.getEntry("card.json");
  if (!cardEntry) {
    return { success: false, error: "Invalid .charx file: missing card.json at root." };
  }

  const cardJson = JSON.parse(cardEntry.getData().toString("utf-8")) as Record<string, unknown>;

  // Resolve the main icon asset from the zip
  let avatarDataUrl: string | null = null;

  // The card.json is a CCv3 wrapper: { spec: "chara_card_v3", data: { ... } }
  const cardData = (cardJson.data ?? cardJson) as Record<string, unknown>;
  const assets = cardData.assets as Array<{ type: string; uri: string; name: string; ext: string }> | undefined;

  if (assets && Array.isArray(assets)) {
    // Find the main icon asset
    const mainIcon =
      assets.find((a) => a.type === "icon" && a.name === "main") ?? assets.find((a) => a.type === "icon");

    if (mainIcon && mainIcon.uri) {
      avatarDataUrl = resolveCharXAsset(zip, mainIcon.uri, mainIcon.ext);
    }
  }

  // If no icon found via assets, check for common fallback paths
  if (!avatarDataUrl) {
    for (const fallback of [
      "assets/icon/images/main.png",
      "assets/icon/images/main.webp",
      "assets/icon/images/main.jpg",
    ]) {
      const entry = zip.getEntry(fallback);
      if (entry) {
        const ext = fallback.split(".").pop() ?? "png";
        const mime = ext === "jpg" ? "jpeg" : ext;
        avatarDataUrl = `data:image/${mime};base64,${entry.getData().toString("base64")}`;
        break;
      }
    }
  }

  // Attach avatar and delegate to the standard importer
  if (avatarDataUrl) {
    cardJson._avatarDataUrl = avatarDataUrl;
  }

  return importSTCharacter(cardJson as Record<string, unknown>, db);
}

/** Resolve an asset URI from a CharX zip to a data URL. */
function resolveCharXAsset(zip: AdmZip, uri: string, ext?: string): string | null {
  // Handle embeded:// URIs (note: spec uses "embeded" not "embedded")
  let zipPath: string | null = null;

  if (uri.startsWith("embeded://")) {
    zipPath = uri.slice("embeded://".length);
  } else if (uri.startsWith("embedded://")) {
    // Accept the common misspelling too
    zipPath = uri.slice("embedded://".length);
  } else if (uri.startsWith("data:image/")) {
    // Already a data URL
    return uri;
  } else if (!uri.includes("://") && uri !== "ccdefault:") {
    // Treat as a relative path within the zip
    zipPath = uri;
  }

  if (!zipPath) return null;

  const entry = zip.getEntry(zipPath);
  if (!entry) return null;

  const fileExt = ext ?? zipPath.split(".").pop() ?? "png";
  const mime = fileExt === "jpg" ? "jpeg" : fileExt;
  return `data:image/${mime};base64,${entry.getData().toString("base64")}`;
}

function normalizeV2(raw: Record<string, unknown>): CharacterData {
  return {
    name: String(raw.name ?? "Unknown"),
    description: String(raw.description ?? ""),
    personality: String(raw.personality ?? ""),
    scenario: String(raw.scenario ?? ""),
    first_mes: String(raw.first_mes ?? ""),
    mes_example: String(raw.mes_example ?? ""),
    creator_notes: String(raw.creator_notes ?? ""),
    system_prompt: String(raw.system_prompt ?? ""),
    post_history_instructions: String(raw.post_history_instructions ?? ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    creator: String(raw.creator ?? ""),
    character_version: String(raw.character_version ?? ""),
    alternate_greetings: Array.isArray(raw.alternate_greetings) ? raw.alternate_greetings.map(String) : [],
    extensions: {
      talkativeness: Number((raw.extensions as Record<string, unknown>)?.talkativeness ?? 0.5),
      fav: Boolean((raw.extensions as Record<string, unknown>)?.fav),
      world: String((raw.extensions as Record<string, unknown>)?.world ?? ""),
      depth_prompt: {
        prompt: String(
          ((raw.extensions as Record<string, unknown>)?.depth_prompt as Record<string, unknown>)?.prompt ?? "",
        ),
        depth: Number(
          ((raw.extensions as Record<string, unknown>)?.depth_prompt as Record<string, unknown>)?.depth ?? 4,
        ),
        role:
          (((raw.extensions as Record<string, unknown>)?.depth_prompt as Record<string, unknown>)?.role as
            | "system"
            | "user"
            | "assistant") ?? "system",
      },
      backstory: String((raw.extensions as Record<string, unknown>)?.backstory ?? ""),
      appearance: String((raw.extensions as Record<string, unknown>)?.appearance ?? ""),
    },
    character_book: (raw.character_book as CharacterData["character_book"]) ?? null,
  };
}

function convertV1toV2(raw: Record<string, unknown>): CharacterData {
  return normalizeV2({
    name: raw.char_name ?? raw.name ?? "Unknown",
    description: raw.char_persona ?? raw.description ?? "",
    personality: raw.personality ?? "",
    scenario: raw.world_scenario ?? raw.scenario ?? "",
    first_mes: raw.char_greeting ?? raw.first_mes ?? "",
    mes_example: raw.example_dialogue ?? raw.mes_example ?? "",
    // Preserve V2 fields when present instead of discarding them
    creator_notes: raw.creator_notes ?? "",
    system_prompt: raw.system_prompt ?? "",
    post_history_instructions: raw.post_history_instructions ?? "",
    tags: raw.tags ?? [],
    creator: raw.creator ?? "",
    character_version: raw.character_version ?? "",
    alternate_greetings: raw.alternate_greetings ?? [],
    extensions: raw.extensions ?? {},
    character_book: raw.character_book ?? null,
  });
}

function convertRisuToV2(raw: Record<string, unknown>): CharacterData {
  return normalizeV2({
    name: raw.name ?? "Unknown",
    description: raw.description ?? "",
    personality: raw.personality ?? "",
    scenario: raw.scenario ?? "",
    first_mes: raw.firstMessage ?? raw.first_mes ?? "",
    mes_example: raw.exampleMessage ?? raw.mes_example ?? "",
    system_prompt: raw.systemPrompt ?? "",
    creator_notes: raw.creatorNotes ?? "",
    post_history_instructions: "",
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    creator: String(raw.creator ?? ""),
    character_version: "",
    alternate_greetings: Array.isArray(raw.alternateGreetings) ? raw.alternateGreetings.map(String) : [],
    extensions: {},
    character_book: null,
  });
}
