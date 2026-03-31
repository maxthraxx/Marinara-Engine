// ──────────────────────────────────────────────
// Storage: Chat Folders
// ──────────────────────────────────────────────
import { eq, desc } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { chatFolders, chats } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export function createChatFoldersStorage(db: DB) {
  return {
    async list() {
      return db.select().from(chatFolders).orderBy(chatFolders.sortOrder);
    },

    async getById(id: string) {
      const rows = await db.select().from(chatFolders).where(eq(chatFolders.id, id));
      return rows[0] ?? null;
    },

    async create(input: { name: string; mode: string; color?: string }) {
      const id = newId();
      const timestamp = now();
      // Shift existing folders down and place new folder at the top
      const existing = await db.select().from(chatFolders);
      for (const f of existing) {
        await db
          .update(chatFolders)
          .set({ sortOrder: f.sortOrder + 1 })
          .where(eq(chatFolders.id, f.id));
      }
      await db.insert(chatFolders).values({
        id,
        name: input.name,
        mode: input.mode as "conversation" | "roleplay" | "visual_novel",
        color: input.color ?? "",
        sortOrder: 0,
        collapsed: "false",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<{ name: string; color: string; sortOrder: number; collapsed: boolean }>) {
      await db
        .update(chatFolders)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.collapsed !== undefined && { collapsed: data.collapsed ? "true" : "false" }),
          updatedAt: now(),
        })
        .where(eq(chatFolders.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      // Unfile all chats in this folder (move back to root)
      await db.update(chats).set({ folderId: null }).where(eq(chats.folderId, id));
      await db.delete(chatFolders).where(eq(chatFolders.id, id));
    },

    async reorder(orderedIds: string[]) {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(chatFolders).set({ sortOrder: i, updatedAt: now() }).where(eq(chatFolders.id, orderedIds[i]!));
      }
    },
  };
}
