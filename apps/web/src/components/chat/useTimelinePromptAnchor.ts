import { useLayoutEffect, useState, type RefObject } from "react";
import type { LegendListRef } from "@legendapp/list/react";
import type { MessageId } from "@t3tools/contracts";
import { observeResize } from "~/lib/observeResize";
import { resolveWebTimelineAnchor } from "./timelineScrollAnchoring";
import type { MessagesTimelineRow } from "./MessagesTimeline.logic";

export function useTimelinePromptAnchor(
  listRef: RefObject<LegendListRef | null>,
  rows: MessagesTimelineRow[],
  messageId: MessageId | null,
  composerInset: number,
  topInsetRef: RefObject<HTMLDivElement | null>,
) {
  const [geometry, setGeometry] = useState({ messageId, offset: 0, hasSpace: true });
  const current =
    geometry.messageId === messageId ? geometry : { messageId, offset: 0, hasSpace: true };
  const config = resolveWebTimelineAnchor(
    rows,
    messageId,
    (row) => (row.kind === "message" && row.message.role === "user" ? row.message.id : null),
    current.offset,
  );
  const index = config?.anchorIndex;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures virtualized rows and the viewport to reserve space for the submitted prompt
  useLayoutEffect(() => {
    const list = listRef.current;
    const viewport = list?.getScrollableNode();
    if (!list || !viewport || index === undefined) return;
    const measure = () => {
      const state = list.getState();
      const height = state.sizeAtIndex(index);
      const top = state.positionAtIndex(index);
      if (height === undefined || top === undefined) return;
      const offset = topInsetRef.current?.getBoundingClientRect().height ?? 0;
      const last = state.data.length - 1;
      const bottom = (state.positionAtIndex(last) ?? top) + (state.sizeAtIndex(last) ?? height);
      const hasSpace = bottom - top < viewport.clientHeight - composerInset - offset - 24;
      setGeometry((old) => {
        return old.messageId === messageId && old.offset === offset && old.hasSpace === hasSpace
          ? old
          : { messageId, offset, hasSpace };
      });
    };
    measure();
    const stopContent = list.getState().listen("totalSize", measure);
    const stopResize = observeResize(viewport, measure);
    const stopInset = topInsetRef.current ? observeResize(topInsetRef.current, measure) : undefined;
    return () => {
      stopContent();
      stopResize();
      stopInset?.();
    };
  }, [listRef, messageId, index, composerInset, topInsetRef]);
  return { ...current, config };
}
