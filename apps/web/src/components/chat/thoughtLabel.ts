import * as DateTime from "effect/DateTime";
import type { WorkLogEntry } from "../../session-logic";

export function thoughtLabel(entries: ReadonlyArray<WorkLogEntry>): string {
  const unique = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  const intervals: Array<[number, number]> = [];
  for (const entry of unique) {
    const item = entry.structuredPayload ?? entry.projectedItem?.item;
    if (!item || item.type !== "reasoning" || !item.startedAt || !item.completedAt)
      return "Thought";
    const start = DateTime.toEpochMillis(item.startedAt);
    const end = DateTime.toEpochMillis(item.completedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "Thought";
    intervals.push([start, end]);
  }
  if (!intervals.length) return "Thought";
  intervals.sort((a, b) => a[0] - b[0]);
  let duration = 0,
    start = intervals[0]![0],
    end = intervals[0]![1];
  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else {
      duration += end - start;
      start = nextStart;
      end = nextEnd;
    }
  }
  const seconds = Math.floor((duration + end - start) / 1000);
  return `Thought ${seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`}`;
}
