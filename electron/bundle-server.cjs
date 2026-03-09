/**
 * Bundle the server into a standalone directory for Electron packaging.
 * Uses esbuild to create a single JS bundle, then copies only native addons.
 */
const esbuild = require("esbuild");
const { cpSync, mkdirSync, existsSync, writeFileSync, rmSync, readdirSync, readlinkSync, statSync } = require("fs");
const { join, resolve } = require("path");

const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "electron", "app-server");
const PNPM_STORE = join(ROOT, "node_modules", ".pnpm");

/** Resolve a pnpm symlink chain to the real package directory */
function resolvePnpmPkg(name, searchDirs) {
  for (const dir of searchDirs) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) {
      try {
        // Follow symlink to real path
        const real = require("fs").realpathSync(candidate);
        return real;
      } catch {
        return candidate;
      }
    }
  }
  // Try finding in .pnpm flat store
  try {
    const entries = readdirSync(PNPM_STORE);
    for (const entry of entries) {
      if (entry.startsWith(name.replace("/", "+") + "@") || entry.startsWith(name + "@")) {
        const nested = join(PNPM_STORE, entry, "node_modules", name);
        if (existsSync(nested)) return nested;
      }
    }
  } catch {}
  return null;
}

async function bundle() {
  console.log("[bundle] Cleaning previous build...");
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  const clientOut = join(ROOT, "electron", "client");
  if (existsSync(clientOut)) rmSync(clientOut, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, "dist"), { recursive: true });

  const searchDirs = [
    join(ROOT, "packages", "server", "node_modules"),
    join(ROOT, "node_modules"),
  ];

  // ── 1. Bundle server code with esbuild ──
  console.log("[bundle] Bundling server with esbuild...");
  await esbuild.build({
    entryPoints: [join(ROOT, "packages", "server", "dist", "index.js")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: join(OUT, "dist", "index.js"),
    external: [
      // Native addons — must stay external
      "@libsql/client",
      "@libsql/*",
      "better-sqlite3",
      // Fastify plugins that use require() dynamically
      "@fastify/static",
      "pino-pretty",
      "pino",
      // Avoid bundling problematic dynamic-import modules
      "send",
      "mime",
    ],
    banner: {
      js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
    },
    logLevel: "warning",
  });

  // ── 2. Copy required packages (follow pnpm symlinks) ──
  console.log("[bundle] Copying runtime dependencies...");

  const pkgsToCopy = [
    "@libsql/client",
    "@libsql/core",
    // Platform-specific libsql native packages
    "@libsql/darwin-x64",
    "@libsql/darwin-arm64",
    "@libsql/win32-x64-msvc",
    "@libsql/linux-x64-gnu",
    "@libsql/linux-arm64-gnu",
    // Fastify static + its deps
    "@fastify/static",
    "@fastify/accept-negotiator",
    "send",
    "mime",
    "ms",
    "http-errors",
    "depd",
    "destroy",
    "encodeurl",
    "escape-html",
    "etag",
    "fresh",
    "on-finished",
    "ee-first",
    "range-parser",
    "statuses",
    "toidentifier",
    "setprototypeof",
    "inherits",
    // Pino logging
    "pino",
    "pino-pretty",
    "fast-redact",
    "on-exit-leak-free",
    "pino-std-serializers",
    "process-warning",
    "quick-format-unescaped",
    "real-require",
    "safe-stable-stringify",
    "sonic-boom",
    "thread-stream",
    "readable-stream",
    "abort-controller",
    "colorette",
    "dateformat",
    "fast-copy",
    "fast-safe-stringify",
    "help-me",
    "joycon",
    "minimist",
    "pump",
    "secure-json-parse",
    "strip-json-comments",
  ];

  for (const pkg of pkgsToCopy) {
    const src = resolvePnpmPkg(pkg, searchDirs);
    if (src && existsSync(src)) {
      const dest = join(OUT, "node_modules", pkg);
      try {
        cpSync(src, dest, { recursive: true, dereference: true });
        console.log(`  ✓ ${pkg}`);
      } catch (err) {
        console.log(`  ⚠ ${pkg}: ${err.message}`);
      }
    }
  }

  // ── 3. Copy client dist ──
  console.log("[bundle] Copying client build...");
  const clientDist = join(ROOT, "packages", "client", "dist");
  mkdirSync(clientOut, { recursive: true });
  if (existsSync(clientDist)) {
    cpSync(clientDist, join(clientOut, "dist"), { recursive: true });
  }

  // ── 4. Create a minimal package.json ──
  writeFileSync(
    join(OUT, "package.json"),
    JSON.stringify({
      name: "@marinara-engine/server",
      version: "0.1.0",
      type: "module",
      main: "./dist/index.js",
    }, null, 2),
  );

  // ── 5. Create data directory ──
  mkdirSync(join(OUT, "data"), { recursive: true });

  // ── 6. Report size ──
  const totalSize = getDirSize(OUT) + getDirSize(clientOut);
  console.log(`[bundle] Done! Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
}

function getDirSize(dir) {
  if (!existsSync(dir)) return 0;
  let size = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) size += getDirSize(p);
    else size += statSync(p).size;
  }
  return size;
}

bundle().catch((err) => {
  console.error("[bundle] Failed:", err);
  process.exit(1);
});
