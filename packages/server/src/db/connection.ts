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
