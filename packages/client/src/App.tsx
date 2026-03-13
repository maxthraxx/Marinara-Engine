// ──────────────────────────────────────────────
// App: Root component with layout
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ModalRenderer } from "./components/layout/ModalRenderer";
import { CustomThemeInjector } from "./components/layout/CustomThemeInjector";
import { Toaster } from "sonner";
import { useUIStore } from "./stores/ui.store";

export function App() {
  const theme = useUIStore((s) => s.theme);
  const fontSize = useUIStore((s) => s.fontSize);
  const visualTheme = useUIStore((s) => s.visualTheme);
  const fontFamily = useUIStore((s) => s.fontFamily);

  // Apply theme + font size to the document root whenever they change
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // Apply visual theme (default / sillytavern) to the document root
  useEffect(() => {
    if (visualTheme && visualTheme !== "default") {
      document.documentElement.dataset.visualTheme = visualTheme;
    } else {
      delete document.documentElement.dataset.visualTheme;
    }
  }, [visualTheme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    // Expose a scale factor for CSS rules that need to scale fixed-pixel values
    // (e.g. icons, hardcoded text sizes). Baseline = 16px (browser default).
    document.documentElement.style.setProperty("--display-scale", String(fontSize / 16));
  }, [fontSize]);

  // Apply custom font family via CSS variable
  useEffect(() => {
    if (fontFamily) {
      document.documentElement.style.setProperty("--font-user", `"${fontFamily}"`);
    } else {
      document.documentElement.style.removeProperty("--font-user");
    }
  }, [fontFamily]);

  return (
    <>
      <CustomThemeInjector />
      <AppShell />
      <ModalRenderer />
      <Toaster
        position="bottom-right"
        theme={theme}
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          },
        }}
      />
    </>
  );
}
