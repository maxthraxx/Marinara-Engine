// ──────────────────────────────────────────────
// Routes: Browser (proxy to character sources)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";

const CHUB_GATEWAY = "https://gateway.chub.ai";
const CHUB_AVATARS = "https://avatars.charhub.io";

/** Safely proxy-fetch an external URL, returning sanitised JSON. */
async function proxyFetch(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upstream ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function botBrowserRoutes(app: FastifyInstance) {
  // ── Search characters on Chub ──
  app.get<{
    Querystring: {
      q?: string;
      page?: string;
      sort?: string;
      nsfw?: string;
      tags?: string;
      excludeTags?: string;
    };
  }>("/chub/search", async (req) => {
    const { q = "", page = "1", sort = "download_count", nsfw = "true", tags, excludeTags } = req.query;

    const params = new URLSearchParams({
      search: q,
      namespace: "characters",
      first: "48",
      page,
      sort,
      asc: "false",
      nsfw,
      nsfl: nsfw,
      nsfw_only: "false",
      include_forks: "true",
      exclude_mine: "true",
      chub: "true",
      count: "false",
    });
    if (tags) params.set("topics", tags);
    if (excludeTags) params.set("excludetopics", excludeTags);

    const data = await proxyFetch(`${CHUB_GATEWAY}/search?${params}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}",
    });
    return data;
  });

  // ── Get full character data from Chub ──
  app.get<{ Params: { "*": string } }>("/chub/character/*", async (req) => {
    const fullPath = (req.params as Record<string, string>)["*"];
    if (!fullPath) throw new Error("Missing character path");
    const nocache = Date.now();
    const data = await proxyFetch(
      `${CHUB_GATEWAY}/api/characters/${encodeURI(fullPath)}?full=true&nocache=${nocache}`,
      { headers: { Accept: "application/json", "Cache-Control": "no-cache" } },
    );
    return data;
  });

  // ── Download character card PNG from Chub (for import) ──
  app.get<{ Params: { "*": string } }>("/chub/download/*", async (req, reply) => {
    const fullPath = (req.params as Record<string, string>)["*"];
    if (!fullPath) throw new Error("Missing character path");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(`${CHUB_AVATARS}/avatars/${encodeURI(fullPath)}/chara_card_v2.png`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);

      const buf = Buffer.from(await res.arrayBuffer());
      return reply
        .header("Content-Type", "image/png")
        .header("Content-Disposition", `attachment; filename="character.png"`)
        .send(buf);
    } finally {
      clearTimeout(timeout);
    }
  });

  // ── Proxy character avatar images (avoids CORS for thumbnails) ──
  app.get<{ Params: { "*": string } }>("/chub/avatar/*", async (req, reply) => {
    const fullPath = (req.params as Record<string, string>)["*"];
    if (!fullPath) throw new Error("Missing avatar path");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${CHUB_AVATARS}/avatars/${encodeURI(fullPath)}/avatar.webp`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        // Fallback to chara_card_v2.png thumbnail
        const res2 = await fetch(`${CHUB_AVATARS}/avatars/${encodeURI(fullPath)}/chara_card_v2.png`, {
          signal: controller.signal,
        });
        if (!res2.ok) return reply.status(404).send({ error: "Avatar not found" });
        const buf = Buffer.from(await res2.arrayBuffer());
        return reply.header("Content-Type", "image/png").header("Cache-Control", "public, max-age=86400").send(buf);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return reply.header("Content-Type", "image/webp").header("Cache-Control", "public, max-age=86400").send(buf);
    } finally {
      clearTimeout(timeout);
    }
  });
}
