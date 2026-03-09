// ──────────────────────────────────────────────
// Electron Main Process — Marinara Engine Desktop
// ──────────────────────────────────────────────
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = 7860;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

let mainWindow = null;
let serverProcess = null;

// ── Resolve paths ──
function getServerPath() {
  // In packaged app, resources are in the asar/unpacked directory
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-server");
  }
  // In development, use the workspace paths
  return path.join(__dirname, "..", "packages", "server");
}

function getDataPath() {
  if (app.isPackaged) {
    // Store user data next to the executable on Windows, or in app support on macOS
    return path.join(app.getPath("userData"), "data");
  }
  return path.join(__dirname, "..", "packages", "server", "data");
}

// ── Start the Fastify server ──
function startServer() {
  return new Promise((resolve, reject) => {
    const serverDir = getServerPath();
    const entryPoint = path.join(serverDir, "dist", "index.js");

    const env = {
      ...process.env,
      PORT: String(PORT),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      DATABASE_URL: `file:${path.join(getDataPath(), "marinara-engine.db")}`,
    };

    // Electron itself is a Node.js runtime — use a child fork
    if (app.isPackaged) {
      serverProcess = spawn(process.execPath, ["--no-warnings", entryPoint], {
        cwd: serverDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        // Electron can't use fork in packaged mode, use spawn with Electron as node
        windowsHide: true,
      });
    } else {
      serverProcess = spawn("node", ["--no-warnings", entryPoint], {
        cwd: serverDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    }

    let started = false;

    serverProcess.stdout?.on("data", (data) => {
      const msg = data.toString();
      console.log("[server]", msg.trim());
      if (!started && msg.includes("listening")) {
        started = true;
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      console.error("[server]", data.toString().trim());
    });

    serverProcess.on("error", (err) => {
      console.error("Failed to start server:", err);
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      console.log(`Server exited with code ${code}`);
      if (!started) reject(new Error(`Server exited with code ${code}`));
    });

    // Fallback: poll the health endpoint
    const startTime = Date.now();
    const poll = setInterval(() => {
      if (started) {
        clearInterval(poll);
        return;
      }
      if (Date.now() - startTime > 30000) {
        clearInterval(poll);
        if (!started) reject(new Error("Server start timed out"));
        return;
      }
      http
        .get(`${SERVER_URL}/api/health`, (res) => {
          if (res.statusCode === 200 && !started) {
            started = true;
            clearInterval(poll);
            resolve();
          }
        })
        .on("error", () => {
          /* still starting */
        });
    }, 500);
  });
}

// ── Create the browser window ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Marinara Engine",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#0a0a0f",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Frameless with custom title bar look
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    show: false,
  });

  mainWindow.loadURL(SERVER_URL);

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ──
app.on("ready", async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error("Failed to start:", err);
    dialog.showErrorBox(
      "Marinara Engine — Startup Error",
      `Failed to start the server:\n${err.message}\n\nPlease check if port ${PORT} is already in use.`,
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // Quit on all platforms (this is a single-window app)
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    // Give it a moment then force kill
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGKILL");
      }
    }, 3000);
  }
});

app.on("activate", () => {
  // macOS: re-create window when dock icon clicked
  if (mainWindow === null) {
    createWindow();
  }
});
