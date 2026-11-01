import { useLocation } from "@tanstack/react-router";
import { useSettingsText } from "./settingsText";
import { lazy, Suspense, useSyncExternalStore } from "react";

import { useTheme } from "../../hooks/useTheme";
import {
  getThemeDefinition,
  subscribeToCustomThemes,
  type ThemeAppearance,
  type ThemeDefinition,
} from "../../themePalette";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { useThemeEditorStore } from "./themeEditorStore";

const SettingsTextProvider = lazy(() =>
  import("./SettingsTextProvider").then((module) => ({ default: module.SettingsTextProvider })),
);

const ThemeEditorPanel = lazy(() =>
  import("./ThemeEditorPanel").then((module) => ({ default: module.ThemeEditorPanel })),
);

function useThemeDefinition(id: string | null | undefined) {
  return useSyncExternalStore(
    subscribeToCustomThemes,
    () => (id ? (getThemeDefinition(id) ?? null) : null),
    () => null,
  );
}

export function ThemeEditorHost() {
  const inSettings = useLocation({
    select: (location) => location.pathname.startsWith("/settings"),
  });
  return inSettings ? (
    <Suspense fallback={null}>
      <SettingsTextProvider>
        <ThemeEditorContent />
      </SettingsTextProvider>
    </Suspense>
  ) : (
    <ThemeEditorContent />
  );
}

function ThemeEditorContent() {
  const settingsText = useSettingsText();

  const session = useThemeEditorStore((store) => store.session);
  const closeThemeEditor = useThemeEditorStore((store) => store.closeThemeEditor);
  const { theme, setTheme, themeHalves, refreshTheme } = useTheme();
  const editingTheme = useThemeDefinition(session?.editingThemeId);
  const seedTheme = useThemeDefinition(session?.seedThemeId);

  const handleSaved = (
    savedTheme: ThemeDefinition,
    { created, mergedAppearance }: { created: boolean; mergedAppearance?: ThemeAppearance },
  ) => {
    if (mergedAppearance) {
      if (!setTheme(savedTheme.id)) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: settingsText("Could not save your theme"),
            description: settingsText(
              "Browser storage is unavailable, so the change was not kept.",
            ),
          }),
        );
        return false;
      }
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: settingsText("{0} updated", savedTheme.label),
          description: settingsText("Its {0} palette was added.", mergedAppearance),
        }),
      );
      return true;
    }
    if (!created) {
      // Reapply the palette without setTheme, which would clear a mix containing the edited theme.
      const wasActive =
        getThemeDefinition(theme)?.id === savedTheme.id ||
        themeHalves?.light === savedTheme.id ||
        themeHalves?.dark === savedTheme.id;
      if (wasActive) refreshTheme();
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: settingsText("{0} saved", savedTheme.label),
          description: wasActive ? "Your changes are now active." : "Your changes are saved.",
        }),
      );
      return true;
    }

    if (!setTheme(savedTheme.id)) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: settingsText("Could not save your theme"),
          description: settingsText("Browser storage is unavailable, so the change was not kept."),
        }),
      );
      return false;
    }
    toastManager.add(
      stackedThreadToast({
        type: "success",
        title: settingsText("{0} created", savedTheme.label),
        description: settingsText("It’s now active."),
      }),
    );
    return true;
  };

  if (!session) return null;

  return (
    <Suspense fallback={null}>
      <ThemeEditorPanel
        editingTheme={editingTheme}
        initialAppearance={session.initialAppearance}
        key={session.id}
        onOpenChange={(open) => {
          if (!open) closeThemeEditor();
        }}
        onSaved={handleSaved}
        open
        restoreTheme={refreshTheme}
        seedName={session.seedName ?? undefined}
        seedTheme={seedTheme}
      />
    </Suspense>
  );
}
