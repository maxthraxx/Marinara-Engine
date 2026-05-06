// ──────────────────────────────────────────────
// Extension Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

// Generous-but-finite size caps. CSS and JS are stored as TEXT in SQLite
// and emitted verbatim into the page, so an unbounded payload would be a
// real DoS surface even past basicAuth.
const MAX_EXTENSION_CSS_BYTES = 256 * 1024; // 256 KiB
const MAX_EXTENSION_JS_BYTES = 1024 * 1024; // 1 MiB

export const createExtensionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  css: z.string().max(MAX_EXTENSION_CSS_BYTES).nullable().optional(),
  js: z.string().max(MAX_EXTENSION_JS_BYTES).nullable().optional(),
  enabled: z.boolean().optional(),
  installedAt: z.string().datetime().optional(),
});

export const updateExtensionSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    css: z.string().max(MAX_EXTENSION_CSS_BYTES).nullable().optional(),
    js: z.string().max(MAX_EXTENSION_JS_BYTES).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Must update at least one field",
  });

export type CreateExtensionInput = z.infer<typeof createExtensionSchema>;
export type UpdateExtensionInput = z.infer<typeof updateExtensionSchema>;
