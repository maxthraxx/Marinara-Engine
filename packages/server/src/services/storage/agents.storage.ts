// ──────────────────────────────────────────────
// Storage: Agent Configs, Runs & Memory
// ──────────────────────────────────────────────
import { eq, and, desc } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { agentConfigs, agentRuns, agentMemory } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CreateAgentConfigInput, AgentResult } from "@marinara-engine/shared";

export function createAgentsStorage(db: DB) {
  return {
    // ── Config CRUD ──

    async list() {
      return db.select().from(agentConfigs).orderBy(desc(agentConfigs.updatedAt));
    },

    async listEnabled() {
      const rows = await db
        .select()
        .from(agentConfigs)
        .where(eq(agentConfigs.enabled, "true"))
        .orderBy(desc(agentConfigs.updatedAt));
      return rows;
    },

    async getById(id: string) {
      const rows = await db.select().from(agentConfigs).where(eq(agentConfigs.id, id));
      return rows[0] ?? null;
    },

    async getByType(type: string) {
      const rows = await db.select().from(agentConfigs).where(eq(agentConfigs.type, type));
      return rows[0] ?? null;
    },

    async create(input: CreateAgentConfigInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(agentConfigs).values({
        id,
        type: input.type,
        name: input.name,
        description: input.description ?? "",
        phase: input.phase,
        enabled: String(input.enabled ?? true),
        connectionId: input.connectionId ?? null,
        promptTemplate: input.promptTemplate ?? "",
        settings: JSON.stringify(input.settings ?? {}),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<CreateAgentConfigInput>) {
      const updateFields: Record<string, unknown> = { updatedAt: now() };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.phase !== undefined) updateFields.phase = data.phase;
      if (data.enabled !== undefined) updateFields.enabled = String(data.enabled);
      if (data.connectionId !== undefined) updateFields.connectionId = data.connectionId;
      if (data.promptTemplate !== undefined) updateFields.promptTemplate = data.promptTemplate;
      if (data.settings !== undefined) updateFields.settings = JSON.stringify(data.settings);
      await db.update(agentConfigs).set(updateFields).where(eq(agentConfigs.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(agentConfigs).where(eq(agentConfigs.id, id));
    },

    // ── Agent Runs ──

    async saveRun(input: { agentConfigId: string; chatId: string; messageId: string; result: AgentResult }) {
      const id = newId();
      await db.insert(agentRuns).values({
        id,
        agentConfigId: input.agentConfigId,
        chatId: input.chatId,
        messageId: input.messageId,
        resultType: input.result.type,
        resultData: JSON.stringify(input.result.data),
        tokensUsed: input.result.tokensUsed,
        durationMs: input.result.durationMs,
        success: String(input.result.success),
        error: input.result.error,
        createdAt: now(),
      });
      return id;
    },

    // ── Agent Memory (persistent KV per agent per chat) ──

    async getMemory(agentConfigId: string, chatId: string): Promise<Record<string, unknown>> {
      const rows = await db
        .select()
        .from(agentMemory)
        .where(and(eq(agentMemory.agentConfigId, agentConfigId), eq(agentMemory.chatId, chatId)));
      const mem: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          mem[row.key] = JSON.parse(row.value);
        } catch {
          mem[row.key] = row.value;
        }
      }
      return mem;
    },

    async setMemory(agentConfigId: string, chatId: string, key: string, value: unknown) {
      const stringValue = typeof value === "string" ? value : JSON.stringify(value);
      const existing = await db
        .select()
        .from(agentMemory)
        .where(
          and(eq(agentMemory.agentConfigId, agentConfigId), eq(agentMemory.chatId, chatId), eq(agentMemory.key, key)),
        );

      if (existing.length > 0) {
        await db
          .update(agentMemory)
          .set({ value: stringValue, updatedAt: now() })
          .where(eq(agentMemory.id, existing[0]!.id));
      } else {
        await db.insert(agentMemory).values({
          id: newId(),
          agentConfigId,
          chatId,
          key,
          value: stringValue,
          updatedAt: now(),
        });
      }
    },
  };
}
