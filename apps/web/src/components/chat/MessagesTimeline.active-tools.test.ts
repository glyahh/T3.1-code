import { RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  deriveMessagesTimelineRows,
  deriveMessagesTimelineRowsWithState,
  liveWorkEntryLabel,
  timelineTurnFoldRunIdsByEntryId,
} from "./MessagesTimeline.logic";

describe("long active tool groups", () => {
  it.each([false, true])(
    "preserves chronological order and the latest activity, expanded=%s",
    (expanded) => {
      const runId = RunId.make("long-active-run");
      const createdAt = "2026-10-12T00:00:00Z";
      const timelineEntries = Array.from({ length: 1_000 }, (_, index) => ({
        id: `work-entry-${index}`,
        kind: "work" as const,
        createdAt,
        entry: {
          id: `work-${index}`,
          createdAt,
          runId,
          label: `Tool ${index}`,
          tone: index % 2 === 0 ? ("thinking" as const) : ("tool" as const),
          itemType: index % 2 === 0 ? ("reasoning" as const) : ("command_execution" as const),
          ...(index % 2 === 0 ? { detail: `Thought ${index}` } : {}),
          toolLifecycleStatus: index === 999 ? ("inProgress" as const) : ("completed" as const),
        },
      }));
      const rows = deriveMessagesTimelineRows({
        timelineEntries,
        isWorking: true,
        runningRunId: runId,
        activeTurnStartedAt: createdAt,
        turnDiffSummaries: [],
        supportsConversationRollback: false,
        expandedWorkGroupIds: new Set(expanded ? ["work-group:work-entry-0"] : []),
      });
      const live = rows.find((row) => row.kind === "work-live");
      expect(live).toBeDefined();
      expect(live?.entry.id).toBe("work-999");
      expect(live && liveWorkEntryLabel(live.entry, undefined, live.active)).toContain("999");
      expect(live?.thought?.id).toBe("work-998");
      expect(live?.groupedEntries.map(({ id }) => id)).toEqual(
        timelineEntries.map(({ entry }) => entry.id),
      );
      expect(live?.groupId).toBe("work-group:work-entry-0");
      const details = rows.filter((row) => row.kind === "work");
      expect(details).toHaveLength(expanded ? 1 : 0);
      if (expanded) {
        expect(details[0]?.groupedEntries).toEqual(live?.groupedEntries);
      }
    },
  );
});

it("keeps live turn and tool disclosures stable through append, manual collapse and completion", () => {
  const runId = RunId.make("compact-run");
  const createdAt = "2026-10-12T00:00:00Z";
  const work = (id: string) => ({
    id,
    kind: "work" as const,
    createdAt,
    entry: {
      id,
      runId,
      createdAt,
      label: "Read file",
      requestKind: "file-read",
      tone: "tool" as const,
      toolLifecycleStatus: "completed" as const,
    },
  });
  const input = {
    timelineEntries: [work("first")],
    isWorking: true,
    runningRunId: runId,
    collapsedLiveRunIds: new Set<RunId>(),
    turnDiffSummaries: [],
    supportsConversationRollback: false,
  };
  expect(timelineTurnFoldRunIdsByEntryId(input).get("first")).toBe(runId);
  const initial = deriveMessagesTimelineRows(input);
  expect(initial.find((row) => row.kind === "turn-fold")).toMatchObject({ expanded: true });
  const live = initial.find((row) => row.kind === "work-live");
  const appendedInput = {
    ...input,
    timelineEntries: [work("first"), work("second")],
    expandedWorkGroupIds: new Set(["work-group:first"]),
  };
  const appended = deriveMessagesTimelineRows(appendedInput);
  expect(appended.find((row) => row.kind === "work-live")).toMatchObject({
    id: live?.id,
    expanded: true,
  });
  const collapsed = deriveMessagesTimelineRows({
    ...appendedInput,
    collapsedLiveRunIds: new Set([runId]),
  });
  expect(collapsed.find((row) => row.kind === "turn-fold")).toMatchObject({ expanded: false });
  expect(
    collapsed.some(
      (row) => row.kind === "work" || row.kind === "work-live" || row.kind === "thinking",
    ),
  ).toBe(false);
  const completed = deriveMessagesTimelineRows({
    ...appendedInput,
    isWorking: false,
    runningRunId: null,
    expandedRunIds: new Set([runId]),
  });
  expect(completed.find((row) => row.kind === "work-toggle")).toMatchObject({
    id: live?.id,
    expanded: true,
  });
  expect(completed.find((row) => row.kind === "turn-fold")?.id).toBe(
    initial.find((row) => row.kind === "turn-fold")?.id,
  );
});

it("closes a tool phase on the first body character without changing tool state", () => {
  const runId = RunId.make("body-boundary");
  const createdAt = "2026-11-01T00:00:00Z";
  const read = (id: string) => ({
    id,
    kind: "work" as const,
    createdAt,
    entry: {
      id,
      runId,
      createdAt,
      label: "Read file",
      requestKind: "file-read",
      tone: "tool" as const,
      toolLifecycleStatus: "inProgress" as const,
    },
  });
  const reads = [read("one"), read("two")];
  const body = (text: string) => ({
    id: "body",
    kind: "message" as const,
    createdAt,
    message: {
      id: "body" as never,
      role: "assistant" as const,
      runId,
      text,
      createdAt,
      updatedAt: createdAt,
      streaming: true,
    },
  });
  const input = {
    timelineEntries: [...reads, body("")],
    isWorking: true,
    runningRunId: runId,
    collapsedLiveRunIds: new Set<RunId>(),
    turnDiffSummaries: [],
    supportsConversationRollback: false,
  };
  const empty = deriveMessagesTimelineRowsWithState(input);
  expect(empty.rows.some((row) => row.kind === "work-live")).toBe(true);
  const started = deriveMessagesTimelineRowsWithState(
    { ...input, timelineEntries: [...reads, body("Result")] },
    empty,
  );
  expect(started.rows.filter((row) => row.kind === "work-toggle")).toMatchObject([
    { summary: "Read 2 files" },
  ]);
  expect(started.rows.some((row) => row.kind === "work-live" || row.kind === "thinking")).toBe(
    false,
  );
  expect(reads.every((row) => row.entry.toolLifecycleStatus === "inProgress")).toBe(true);
  for (const status of ["completed", "failed", "stopped"] as const) {
    const late = deriveMessagesTimelineRows({
      ...input,
      timelineEntries: [
        { ...reads[0]!, entry: { ...reads[0]!.entry, toolLifecycleStatus: status } },
        reads[1]!,
        body("Result"),
      ],
    });
    expect(late.some((row) => row.kind === "work-live" || row.kind === "thinking")).toBe(false);
    expect(late.filter((row) => row.kind === "work-toggle")).toHaveLength(1);
  }
  const nextPhase = deriveMessagesTimelineRows({
    ...input,
    timelineEntries: [...reads, body("Result"), read("three")],
  });
  expect(nextPhase.filter((row) => row.kind === "work-toggle")).toHaveLength(1);
  expect(nextPhase.find((row) => row.kind === "work-live")).toMatchObject({
    entry: { id: "three" },
  });
  const waiting = deriveMessagesTimelineRows({
    ...input,
    timelineEntries: reads.map((row) => ({
      ...row,
      entry: { ...row.entry, toolLifecycleStatus: "completed" as const },
    })),
  });
  expect(waiting.filter((row) => row.kind === "work-live")).toMatchObject([{ active: false }]);
  expect(waiting.some((row) => row.kind === "thinking")).toBe(false);
  const failed = {
    ...reads[0]!,
    entry: { ...reads[0]!.entry, toolLifecycleStatus: "failed" as const },
  };
  const collapsed = deriveMessagesTimelineRows({
    ...input,
    timelineEntries: [failed, reads[1]!, body("Result")],
    collapsedLiveRunIds: new Set([runId]),
  });
  expect(
    collapsed.filter((row) => ["work", "work-toggle", "work-live", "thinking"].includes(row.kind)),
  ).toEqual([]);
});
