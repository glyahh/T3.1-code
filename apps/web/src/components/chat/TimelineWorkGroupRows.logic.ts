import { formatDuration } from "@t3tools/shared/orchestrationTiming";

function formatWorkingTimer(startIso: string, endIso: string): string | null {
  const startedAtMs = Date.parse(startIso);
  const endedAtMs = Date.parse(endIso);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000));
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }

  return formatDuration(elapsedSeconds * 1_000);
}

export function formatWorkingTimerNow(startIso: string): string {
  return formatWorkingTimer(startIso, new Date().toISOString()) ?? "0s";
}

export function planningWaitLabel(progressAtMs: number, nowMs: number): string {
  return nowMs - progressAtMs >= 30_000 ? "Taking longer than expected" : "Planning next move";
}

export function formatPreciseWorkingDuration(elapsedMs: number): string {
  const seconds = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs / 1000)) : 0;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const tail = `${String(seconds % 60).padStart(2, "0")}s`;
  return minutes < 60
    ? `${minutes}m ${tail}`
    : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m ${tail}`;
}
