// ──────────────────────────────────────────────
// Routes: Custom Tools
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createCustomToolSchema, updateCustomToolSchema } from "@marinara-engine/shared";
import { createCustomToolsStorage } from "../services/storage/custom-tools.storage.js";

export async function customToolsRoutes(app: FastifyInstance) {
  const storage = createCustomToolsStorage(app.db);

  app.get("/", async () => {
    return storage.list();
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const tool = await storage.getById(req.params.id);
    if (!tool) return reply.status(404).send({ error: "Tool not found" });
    return tool;
  });

  app.post("/", async (req, reply) => {
    const input = createCustomToolSchema.parse(req.body);
    // Check name uniqueness
    const existing = await storage.getByName(input.name);
    if (existing) {
      return reply.status(409).send({ error: `A tool named "${input.name}" already exists.` });
    }
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = updateCustomToolSchema.parse(req.body);
    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });
}
