// ──────────────────────────────────────────────
// Database Connection
// ──────────────────────────────────────────────
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema/index.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let db: ReturnType<typeof createDB> | null = null;

function createDB(dbPath: string) {
  // Ensure directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const client = createClient({
    url: `file:${dbPath}`,
  });

  // Enable WAL journal mode and relaxed sync for much better write perf on Windows/NTFS.
  // WAL avoids the expensive DELETE-journal fsync cycle per transaction.
  client.execute("PRAGMA journal_mode=WAL");
  client.execute("PRAGMA synchronous=NORMAL");

  return drizzle(client, { schema });
}

export function getDB() {
  if (!db) {
    const dbUrl = process.env.DATABASE_URL ?? "file:./data/marinara-engine.db";
    const dbPath = dbUrl.replace(/^file:/, "");
    db = createDB(dbPath);
  }
  return db;
}

export type DB = ReturnType<typeof getDB>;
