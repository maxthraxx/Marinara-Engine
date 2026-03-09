/**
 * electron-builder configuration for Marinara Engine
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: "com.marinara-engine.app",
  productName: "Marinara Engine",
  copyright: "Copyright © 2026 Marianna",

  directories: {
    output: "release",
    buildResources: "electron/resources",
  },

  files: [
    "electron/main.cjs",
    "electron/icon.png",
  ],

  extraResources: [
    {
      from: "electron/app-server",
      to: "app-server",
      filter: ["**/*"],
    },
    {
      from: "electron/client",
      to: "client",
      filter: ["**/*"],
    },
  ],

  // ── Windows ──
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    icon: "electron/resources/icon.png",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Marinara Engine",
    artifactName: "Marinara-Engine-Setup-${version}.${ext}",
  },

  // ── macOS ──
  mac: {
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"],
      },
    ],
    icon: "electron/resources/icon.png",
    category: "public.app-category.entertainment",
  },
  dmg: {
    artifactName: "Marinara-Engine-${version}-${arch}.${ext}",
  },

  // ── Linux ──
  linux: {
    target: [
      {
        target: "AppImage",
        arch: ["x64"],
      },
    ],
    icon: "electron/resources/icon.png",
    category: "Game",
    artifactName: "Marinara-Engine-${version}.${ext}",
  },

  // Don't use asar for the server code — it needs native modules (better-sqlite3)
  asar: false,

  // Rebuild native modules for Electron
  npmRebuild: true,
};
