// ──────────────────────────────────────────────
// Routes: Agents
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createAgentConfigSchema, updateAgentConfigSchema, BUILT_IN_AGENTS } from "@marinara-engine/shared";
import { createAgentsStorage } from "../services/storage/agents.storage.js";

export async function agentsRoutes(app: FastifyInstance) {
  const storage = createAgentsStorage(app.db);

  app.get("/", async () => {
    return storage.list();
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const agent = await storage.getById(req.params.id);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    return agent;
  });

  app.post("/", async (req) => {
    const input = createAgentConfigSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = updateAgentConfigSchema.parse(req.body);
    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  /** Toggle a built-in agent by type. Creates config if first toggle. */
  app.put<{ Params: { agentType: string } }>("/toggle/:agentType", async (req, reply) => {
    const { agentType } = req.params;
    const builtIn = BUILT_IN_AGENTS.find((a) => a.id === agentType);
    if (!builtIn) {
      return reply.status(404).send({ error: "Unknown agent type" });
    }

    const existing = await storage.getByType(agentType);
    if (existing) {
      const currentEnabled = existing.enabled === "true";
      return storage.update(existing.id, { enabled: !currentEnabled });
    }

    // First toggle — create with opposite of default
    return storage.create({
      type: builtIn.id,
      name: builtIn.name,
      description: builtIn.description,
      phase: builtIn.phase,
      enabled: !builtIn.enabledByDefault,
      connectionId: null,
      promptTemplate: "",
      settings: builtIn.defaultInjectAsSection ? { injectAsSection: true } : {},
    });
  });
}
