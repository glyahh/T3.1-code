import * as DateTime from "effect/DateTime";
import { TimelinePendingApprovalRow } from "./TimelinePendingApprovalRow";
import { WorkLogButton, WorkLogList, WorkLogRow } from "./WorkLog";
import type { WorktreeSetupSnapshot } from "@t3tools/contracts";
import { type ToolActivityIcon } from "@t3tools/contracts";
import { resolveWorkGroupScrollAnchor } from "@t3tools/client-runtime/work-log/scroll-anchor";
import { observeResize } from "~/lib/observeResize";
import { tickTextContent } from "~/lib/tickTextContent";
import { deadlineStore } from "@t3tools/client-runtime/clock";
import { observeVisibleAnimation } from "../../lib/visibleAnimation";
import {
  memo,
  use,
  useLayoutEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LegendList, type LegendListRef } from "@legendapp/list/react";
import {
  summarizeToolGroup,
  toolGroupSummaryKind,
} from "@t3tools/client-runtime/work-log/presentation";
import { workEntryDisplayIndicatesToolFailure, workLogEntryIsToolLike } from "../../session-logic";
import { Minimize2Icon, XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { getVirtualizedScrollFadeClassName } from "../ui/scroll-area";
import {
  liveWorkEntryLabel,
  resolveWorkGroupScrollIndex,
  shouldFollowWorkGroupAppend,
  workEntryIsVisibleInGroup,
  type MessagesTimelineRow,
} from "./MessagesTimeline.logic";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Spinner } from "../ui/spinner";
import { WorktreeSetupCard } from "./WorktreeSetupCard";
import { cn } from "~/lib/utils";
import { type TimestampFormat } from "@t3tools/contracts/settings";
import {
  TimelineRowCtx,
  TimelineRowActivityCtx,
  WorkGroupViewCtx,
  type TimelineWorkEntry,
  type TimelineRow,
} from "./timelineRowContext";
import { TimelineRowTimestamp, ActivityShimmerOverlay } from "./TimelineRowParts";
import {
  failedToolIconClassName,
  toolIconAcceptsTint,
  type WorkEntryIconName,
  ToolActivityIconView,
} from "./TimelineToolActivityIcon";
import {
  useThreadReadTarget,
  threadReadLabel,
  ReasoningTraceContent,
  SimpleWorkEntryRow,
} from "./TimelineWorkEntryRow";
import { toolGroupSummaryIconName, workEntryIconName } from "./TimelineWorkEntryRow.logic";
import { planningWaitLabel, formatWorkingTimerNow } from "./TimelineWorkGroupRows.logic";

export const WorkGroupSection = memo(function WorkGroupSection({
  anchorKey,
  disclosureAnchorKey = anchorKey,
  groupedEntries,
  isExpandedToolGroup,
  displayLabel,
}: {
  anchorKey: string;
  disclosureAnchorKey?: string;
  groupedEntries: Extract<MessagesTimelineRow, { kind: "work" }>["groupedEntries"];
  isExpandedToolGroup: boolean;
  displayLabel?: string | undefined;
}) {
  const { workspaceRoot, routeThreadKey, onToggleWorkEntry, pendingApprovals } =
    use(TimelineRowCtx);
  const onToggleStandaloneEntry = (collapsed: boolean) =>
    onToggleWorkEntry(disclosureAnchorKey, collapsed);
  const nonEmptyEntries = groupedEntries.filter((entry) => {
    const item = entry.projectedItem?.item;
    return (
      (item?.type === "approval_request" && pendingApprovals.has(item.requestId)) ||
      workEntryIsVisibleInGroup(entry, isExpandedToolGroup)
    );
  });

  if (nonEmptyEntries.length === 0) return null;
  if (isExpandedToolGroup && nonEmptyEntries.every((entry) => entry.itemType === "reasoning")) {
    return <ReasoningTraceContent entries={nonEmptyEntries} />;
  }
  if (isExpandedToolGroup) {
    return (
      <ExpandedWorkGroupEntries
        key={`${routeThreadKey}:${anchorKey}`}
        anchorKey={anchorKey}
        disclosureAnchorKey={disclosureAnchorKey}
        entries={nonEmptyEntries}
        workspaceRoot={workspaceRoot}
      />
    );
  }

  return (
    <section aria-label="Activity">
      {nonEmptyEntries.map((workEntry) => (
        <SimpleWorkEntryRow
          key={workEntry.id}
          workEntry={workEntry}
          workspaceRoot={workspaceRoot}
          displayLabel={displayLabel}
          onToggleEntry={onToggleStandaloneEntry}
        />
      ))}
    </section>
  );
});

function WorkingTimer({ createdAt }: { createdAt: string }) {
  return (
    <span
      ref={tickTextContent(() => formatWorkingTimerNow(createdAt), true)}
      className="tabular-nums"
    />
  );
}

const compactWorkEntryHeight = 24;

function ExpandedWorkGroupEntries({
  anchorKey,
  disclosureAnchorKey,
  entries,
  workspaceRoot,
}: {
  anchorKey: string;
  disclosureAnchorKey: string;
  entries: TimelineWorkEntry[];
  workspaceRoot: string | undefined;
}) {
  const { workGroupViewState: viewState, onToggleWorkEntry } = use(TimelineRowCtx);
  const [initialScrollIndex] = useState(() =>
    resolveWorkGroupScrollIndex(entries, viewState.scrollPositions.get(anchorKey)),
  );
  const [restoringPosition, setRestoringPosition] = useState(initialScrollIndex !== undefined);
  const listRef = useRef<LegendListRef>(null);
  const [expandedContentHeight, setExpandedContentHeight] = useState(0);
  const [fades, setFades] = useState({ top: false, bottom: false, viewportHeight: 0 });
  const [appendState, setAppendState] = useState({ entries, follow: false });
  // Capture the pre-change edge once per incoming array, before new layout
  // metrics arrive. Edge/viewport changes never turn a status update into a follow.
  if (appendState.entries !== entries) {
    setAppendState({
      entries,
      follow:
        fades.viewportHeight > 0 &&
        shouldFollowWorkGroupAppend(appendState.entries, entries, fades.bottom ? Infinity : 0),
    });
  }

  const groupView = {
    state: viewState,
    onToggleEntry: (collapsed: boolean) => onToggleWorkEntry(disclosureAnchorKey, collapsed),
  };
  const updateScrollFades = () => {
    const element = listRef.current?.getScrollableNode();
    if (!element) return;
    const distanceFromEnd = element.scrollHeight - element.clientHeight - element.scrollTop;
    const viewportHeight = element.clientHeight;
    const top = element.scrollTop > 1;
    const bottom = distanceFromEnd > 1;
    setFades((previous) =>
      previous.top === top &&
      previous.bottom === bottom &&
      previous.viewportHeight === viewportHeight
        ? previous
        : { top, bottom, viewportHeight },
    );
  };

  const handleScroll = () => {
    const state = listRef.current?.getState();
    const position = state && resolveWorkGroupScrollAnchor(state);
    if (position) {
      viewState.scrollPositions.set(anchorKey, {
        entryId: position.rowId,
        offset: position.offsetWithinRow,
      });
    }
    updateScrollFades();
  };

  const handleLoad = () => {
    const list = listRef.current;
    const element = list?.getScrollableNode();
    if (initialScrollIndex && list && element) {
      // Bootstrap can report the restored target before the DOM has applied it.
      // Reconcile once at load, before releasing the measured anchor row.
      const offset = Math.max(
        0,
        Math.min(list.getState().scroll, element.scrollHeight - element.clientHeight),
      );
      if (Math.abs(element.scrollTop - offset) > 1) {
        void list.scrollToOffset({ offset, animated: false });
      }
    }
    setRestoringPosition(false);
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- observes the list scroller and its content with ResizeObserver to update scroll fades
  useLayoutEffect(() => {
    const element = listRef.current?.getScrollableNode();
    if (!element) return;
    updateScrollFades();
    const content = element.firstElementChild;
    return observeResize(content ? [element, content] : element, updateScrollFades);
  }, [updateScrollFades]);

  const renderEntry = ({ item }: { item: TimelineWorkEntry }) => (
    <SimpleWorkEntryRow key={item.id} workEntry={item} workspaceRoot={workspaceRoot} />
  );

  const updateExpandedContentHeight = () => {
    const state = listRef.current?.getState();
    let height = 0;
    for (const entryId of viewState.expandedEntries) {
      if (state?.indexByKey(entryId) === undefined) continue;
      height += Math.max(
        0,
        (state.sizes.get(entryId) ?? compactWorkEntryHeight) - compactWorkEntryHeight,
      );
    }
    setExpandedContentHeight(height);
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads expanded row sizes from LegendList's measured state after layout
  useLayoutEffect(updateExpandedContentHeight, [entries, updateExpandedContentHeight]);

  return (
    <WorkGroupViewCtx value={groupView}>
      <WorkLogList>
        <LegendList
          ref={listRef}
          data={entries}
          extraData={workspaceRoot}
          keyExtractor={workEntryKey}
          renderItem={renderEntry}
          estimatedItemSize={compactWorkEntryHeight}
          drawDistance={240}
          recycleItems
          {...(initialScrollIndex ? { initialScrollIndex } : {})}
          maintainScrollAtEnd={
            appendState.follow ? { animated: false, on: { dataChange: true } } : false
          }
          maintainScrollAtEndThreshold={1 / Math.max(1, fades.viewportHeight)}
          // Measure the restored row even when an intra-row offset puts its
          // estimated bounds outside the list's small bootstrap render window.
          {...(restoringPosition && initialScrollIndex
            ? { alwaysRender: { indices: [initialScrollIndex.index] } }
            : {})}
          maintainVisibleContentPosition
          onLoad={handleLoad}
          onScroll={handleScroll}
          onLayout={updateScrollFades}
          onItemSizeChanged={updateExpandedContentHeight}
          tabIndex={0}
          role="region"
          aria-label="Tool calls"
          data-tool-group-scroll
          style={{ maxHeight: `calc(min(18rem, 50dvh) + ${expandedContentHeight}px)` }}
          className={cn(
            "scrollbar-gutter-stable scroll-py-6 overflow-x-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
            getVirtualizedScrollFadeClassName(fades),
          )}
        />
      </WorkLogList>
    </WorkGroupViewCtx>
  );
}

const workEntryKey = (entry: TimelineWorkEntry) => entry.id;

export function WorkingTimelineRow({ row }: { row: Extract<TimelineRow, { kind: "working" }> }) {
  const { isCompacting, isPreparingWorktree, backgroundWorktreeSetup } =
    use(TimelineRowActivityCtx);
  const compacting = row.compacting === true || isCompacting;
  if (!isPreparingWorktree && !compacting && !backgroundWorktreeSetup) return null;
  const shimmer = isPreparingWorktree || compacting;
  const label = isPreparingWorktree ? (
    "Setting up worktree…"
  ) : compacting ? (
    <CompactingLabel createdAt={row.createdAt} />
  ) : row.createdAt ? (
    <>
      Working for <WorkingTimer createdAt={row.createdAt} />
    </>
  ) : (
    "Working..."
  );
  return (
    <div className="border-b border-border/60 pb-2 pt-1">
      <div className="flex h-6 min-w-0 items-baseline gap-2 px-1 text-sm leading-relaxed text-muted-foreground tabular-nums">
        <span
          ref={shimmer ? observeVisibleAnimation : undefined}
          className="relative shrink-0 overflow-hidden whitespace-nowrap"
        >
          {label}
          {shimmer ? <ActivityShimmerOverlay>{label}</ActivityShimmerOverlay> : null}
        </span>
        {backgroundWorktreeSetup ? (
          <BackgroundWorktreeSetupChip snapshot={backgroundWorktreeSetup} />
        ) : null}
      </div>
    </div>
  );
}

function BackgroundWorktreeSetupChip({ snapshot }: { snapshot: WorktreeSetupSnapshot }) {
  const ctx = use(TimelineRowCtx);
  const terminalId = snapshot.setupScript?.terminalId ?? null;
  const openTerminal = ctx.onOpenWorktreeSetupTerminal;
  const onOpenTerminal = openTerminal && terminalId ? () => openTerminal(terminalId) : null;
  const scriptName = snapshot.setupScript?.name ?? "Setup script";
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost-muted"
            size="micro"
            className="ml-auto min-w-0 shrink-0"
            aria-label={`Background setup is still running: ${scriptName}. Show setup progress.`}
          />
        }
      >
        <Spinner className="size-3 shrink-0" />
        <span className="truncate">Background setup</span>
      </PopoverTrigger>
      <PopoverPopup side="bottom" align="end" width="lg" padding="compact">
        <WorktreeSetupCard
          snapshot={snapshot}
          embedded
          onCancel={null}
          onWorkLocally={null}
          onOpenTerminal={onOpenTerminal}
        />
      </PopoverPopup>
    </Popover>
  );
}

function CompactingLabel({ createdAt }: { createdAt: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Minimize2Icon aria-hidden="true" className="size-3" />
      {createdAt ? (
        <span>
          Compacting for <WorkingTimer createdAt={createdAt} />
        </span>
      ) : (
        "Compacting…"
      )}
    </span>
  );
}

function LiveActivityRow({
  label,
  activityKey,
  iconName,
  toolIcon,
  failed = false,
  active = false,
  shimmer = false,
  onToggle,
  expanded,
}: {
  label: ReactNode;
  activityKey?: string | undefined;
  iconName?: WorkEntryIconName;
  toolIcon?: ToolActivityIcon | undefined;
  failed?: boolean;
  active?: boolean;
  shimmer?: boolean;
  onToggle?: (() => void) | undefined;
  expanded?: boolean | undefined;
}) {
  const animated = active && !failed;
  return (
    <div className="relative min-h-6 w-full max-w-full min-w-0 overflow-hidden rounded-md text-sm leading-relaxed">
      <LiveActivityContent
        label={label}
        activityKey={activityKey}
        iconName={iconName}
        toolIcon={toolIcon}
        failed={failed}
        active={animated && shimmer}
        onToggle={onToggle}
        expanded={expanded}
      />
    </div>
  );
}

function LiveActivityContent({
  label,
  activityKey,
  iconName,
  toolIcon,
  failed = false,
  active = false,
  highlighted = false,
  onToggle,
  expanded,
}: {
  label: ReactNode;
  activityKey?: string | undefined;
  iconName: WorkEntryIconName | undefined;
  toolIcon?: ToolActivityIcon | undefined;
  failed?: boolean;
  active?: boolean;
  highlighted?: boolean;
  onToggle?: (() => void) | undefined;
  expanded?: boolean | undefined;
}) {
  const showTrailingFailureMark =
    failed && iconName !== undefined && !toolIconAcceptsTint(toolIcon);

  return (
    <WorkLogRow
      activity
      onClick={onToggle}
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (event) => {
              if (
                event.target === event.currentTarget &&
                (event.key === "Enter" || event.key === " ")
              ) {
                event.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
      aria-expanded={onToggle ? expanded : undefined}
      label={
        <ExecutionStatusLabel
          label={label}
          activityKey={activityKey}
          highlighted={highlighted}
          active={active}
        />
      }
      trailing={
        showTrailingFailureMark ? (
          <XIcon aria-hidden className={cn("size-3 shrink-0", failedToolIconClassName)} />
        ) : null
      }
    />
  );
}

function ExecutionStatusLabel({
  label,
  activityKey,
  highlighted,
  active,
}: {
  label: ReactNode;
  activityKey?: string | undefined;
  highlighted: boolean;
  active: boolean;
}) {
  const current = useRef<HTMLSpanElement>(null);
  const labelText = useRef<HTMLSpanElement>(null);
  const outgoing = useRef<HTMLSpanElement>(null);
  const previous = useRef<string | undefined>(undefined);
  const previousKey = useRef<string | undefined>(undefined);
  const transitionKey = activityKey ?? label;
  const readLabel = useEffectEvent(() =>
    typeof label === "string" ? label : (labelText.current?.textContent ?? ""),
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- animates committed status text without delaying provider output
  useLayoutEffect(() => {
    const old = previous.current;
    const next = readLabel();
    previous.current = next;
    const key = typeof transitionKey === "string" ? transitionKey : next;
    const sameActivity = previousKey.current === key;
    previousKey.current = key;
    if (
      sameActivity ||
      !active ||
      !next ||
      !current.current ||
      !outgoing.current ||
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      current.current.getBoundingClientRect().bottom <= 0 ||
      current.current.getBoundingClientRect().top >= window.innerHeight
    )
      return;
    const style = getComputedStyle(current.current);
    const cssDuration = style.getPropertyValue("--agent-state-duration").trim();
    const duration = Number.parseFloat(cssDuration) * (cssDuration.endsWith("ms") ? 1 : 1_000);
    if (!duration) return;
    outgoing.current.textContent = old ?? "";
    const options = {
      duration,
      easing: style.getPropertyValue("--agent-motion-ease").trim() || "ease-out",
    };
    const leave =
      old === undefined
        ? null
        : outgoing.current.animate(
            [
              { opacity: 1, transform: "translateY(0)" },
              { opacity: 0, transform: "translateY(-100%)" },
            ],
            options,
          );
    const enter = current.current.animate(
      [
        { opacity: 0, transform: "translateY(100%)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      options,
    );
    return () => {
      leave?.cancel();
      enter.cancel();
    };
  }, [transitionKey, active]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- retains the latest committed text for the next activity's outgoing DOM layer
  useLayoutEffect(() => {
    previous.current = typeof label === "string" ? label : (labelText.current?.textContent ?? "");
  }, [label]);
  return (
    <span
      ref={active ? observeVisibleAnimation : undefined}
      className={cn("relative block overflow-hidden", highlighted && "text-foreground")}
    >
      <span ref={current} className="relative block overflow-hidden">
        <span ref={labelText} className="block truncate">
          {label}
        </span>
        {active ? <ActivityShimmerOverlay>{label}</ActivityShimmerOverlay> : null}
      </span>
      <span
        ref={outgoing}
        aria-hidden
        className="pointer-events-none absolute inset-0 block truncate opacity-0"
      />
    </span>
  );
}

export function WorkGroupTimelineRow({
  row,
}: {
  row: Extract<TimelineRow, { kind: "work-live" | "work-toggle" | "thinking" | "live-status" }>;
}) {
  const ctx = use(TimelineRowCtx);
  const { isCompacting, isPreparingWorktree } = use(TimelineRowActivityCtx);
  const entry = row.kind === "work-live" || row.kind === "live-status" ? row.entry : null;
  const target = useThreadReadTarget(
    entry ?? { id: row.id, createdAt: row.createdAt ?? "", label: "", tone: "info" },
    ctx.activeThreadEnvironmentId,
  );
  const [expandedThoughtId, setExpandedThoughtId] = useState<string | null>(null);
  const reasoning = entry?.itemType === "reasoning" ? entry : null;
  const thoughtExpanded = reasoning !== null && expandedThoughtId === reasoning.id;
  const item = entry?.projectedItem?.item;
  const progressAt = entry?.projectedItem
    ? DateTime.formatIso(entry.projectedItem.item.updatedAt)
    : (entry?.createdAt ?? row.createdAt ?? "");
  const waiting = row.kind !== "work-toggle" && entry?.toolLifecycleStatus !== "inProgress";
  const deadline = deadlineStore(waiting ? Date.parse(progressAt) + 30_000 : null);
  const slow = useSyncExternalStore(deadline.subscribe, deadline.getSnapshot);
  const approval =
    item?.type === "approval_request" ? ctx.pendingApprovals.get(item.requestId) : undefined;
  if (approval) return <TimelinePendingApprovalRow approval={approval} />;
  if (
    (row.kind === "thinking" || row.kind === "live-status") &&
    (isCompacting || isPreparingWorktree)
  )
    return <WorkLogRow label="" />;
  const label = entry
    ? liveWorkEntryLabel(entry, ctx.workspaceRoot, row.kind === "work-live" && row.active)
    : "";
  const summaryTools =
    row.kind === "work-live"
      ? row.groupedEntries.filter(
          (entry) =>
            workLogEntryIsToolLike(entry) &&
            entry.itemType !== "reasoning" &&
            entry.itemType !== "approval_request" &&
            entry.itemType !== "user_input_request",
        )
      : [];
  const liveSummary = summaryTools.length ? summarizeToolGroup(summaryTools, 3, "attempts") : null;
  const summary =
    row.kind === "work-toggle"
      ? row.summary
      : (liveSummary?.summary ??
        (row.kind === "work-live" && row.expanded
          ? summarizeToolGroup(row.groupedEntries, 3).summary
          : null));
  const failed = entry
    ? workEntryDisplayIndicatesToolFailure(entry)
    : row.kind === "work-toggle" && row.hasFailure;
  const status =
    entry?.toolLifecycleStatus === "inProgress"
      ? entry.itemType === "reasoning"
        ? label
        : (threadReadLabel(label, target)?.text ?? label)
      : planningWaitLabel(0, slow ? 30_000 : 0);
  if (row.kind === "work-live" && row.separateStatus && !summary) return null;
  return (
    <div
      className={
        row.kind === "live-status" && row.hidden ? "hidden" : "flex min-w-0 flex-col gap-2"
      }
    >
      {row.kind !== "thinking" &&
      row.kind !== "live-status" &&
      (row.kind !== "work-live" || !row.separateStatus || summary) ? (
        <WorkGroupHeader
          label={summary ?? status}
          active={row.kind === "work-live" && !summary}
          iconName={
            row.kind === "work-live" && !summary
              ? undefined
              : liveSummary
                ? toolGroupSummaryIconName(toolGroupSummaryKind(summaryTools))
                : entry
                  ? workEntryIconName(entry)
                  : row.kind === "work-toggle"
                    ? (row.toolSurface ?? toolGroupSummaryIconName(row.summaryKind))
                    : "brain"
          }
          toolIcon={
            liveSummary
              ? undefined
              : entry
                ? (entry.toolIcon ?? entry.toolSource?.icon)
                : row.kind === "work-toggle"
                  ? row.toolIcon
                  : undefined
          }
          failed={liveSummary?.hasFailure ?? failed}
          expanded={row.expanded === true}
          createdAt={row.createdAt ?? ""}
          timestampFormat={ctx.timestampFormat}
          onToggle={() => {
            if (row.groupId) ctx.onToggleWorkGroup(row.groupId, row.id);
          }}
        />
      ) : null}
      {row.kind === "live-status" ||
      (!row.expanded &&
        (row.kind === "thinking" ||
          (row.kind === "work-live" && !row.separateStatus && summary))) ? (
        <LiveActivityRow
          iconName={
            entry?.toolLifecycleStatus === "inProgress" ? workEntryIconName(entry) : "brain"
          }
          label={status}
          activityKey={
            row.kind === "live-status"
              ? `${row.activityKey}:${waiting ? (slow ? "slow" : "waiting") : "running"}`
              : undefined
          }
          active={ctx.pendingApprovals.size === 0}
          shimmer={ctx.pendingApprovals.size === 0}
          failed={failed}
          expanded={thoughtExpanded}
          onToggle={
            reasoning?.detail?.trim()
              ? () => {
                  ctx.onToggleWorkEntry(row.id, thoughtExpanded);
                  setExpandedThoughtId(thoughtExpanded ? null : reasoning.id);
                }
              : undefined
          }
        />
      ) : null}
      {reasoning && thoughtExpanded && !row.expanded ? (
        <ReasoningTraceContent entries={[reasoning]} />
      ) : null}
    </div>
  );
}

function WorkGroupHeader(props: {
  label: ReactNode;
  active?: boolean;
  iconName: WorkEntryIconName | undefined;
  toolIcon?: ToolActivityIcon | undefined;
  failed?: boolean | undefined;
  expanded: boolean;
  createdAt: string;
  timestampFormat: TimestampFormat;
  onToggle: () => void;
}) {
  return (
    <WorkLogButton
      activity
      aria-label={
        typeof props.label === "string"
          ? props.failed
            ? `${props.label}, tool call failed`
            : props.label
          : undefined
      }
      aria-expanded={props.expanded}
      onClick={props.onToggle}
      icon={
        props.iconName ? (
          <ToolActivityIconView
            icon={props.toolIcon}
            fallbackName={props.iconName}
            className={cn(
              "size-4 shrink-0 stroke-2",
              props.failed ? failedToolIconClassName : "text-agent-activity",
            )}
            muted={!props.failed}
          />
        ) : null
      }
      label={
        <ExecutionStatusLabel
          label={props.label}
          highlighted={false}
          active={props.active === true}
        />
      }

      trailing={
        <TimelineRowTimestamp createdAt={props.createdAt} timestampFormat={props.timestampFormat} />
      }
    />
  );
}
