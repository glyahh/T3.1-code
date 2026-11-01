import { createContext, use } from "react";

export function originalSettingsText<T>(value: T, ...values: unknown[]): T {
  if (typeof value !== "string" || values.length === 0) return value;
  return value.replace(/\{(\d+)\}/g, (match, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : match,
  ) as T;
}

export const SettingsTextContext = createContext(originalSettingsText);

export function useSettingsText() {
  return use(SettingsTextContext);
}
