import type { ReactNode } from "react";
import chinese from "./settings.zh-CN.json";
import { originalSettingsText, SettingsTextContext } from "./settingsText";

const translations: Readonly<Record<string, string>> = chinese;
function translateSettingsText<T>(value: T, ...values: unknown[]): T {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const translated = translations[trimmed];
  return originalSettingsText(
    translated === undefined ? value : (value.replace(trimmed, () => translated) as T),
    ...values,
  );
}

export function SettingsTextProvider({ children }: { children: ReactNode }) {
  return <SettingsTextContext value={translateSettingsText}>{children}</SettingsTextContext>;
}
