import { Component, type ReactNode, type RefObject } from "react";
import type { LegendListRef } from "@legendapp/list/react";

export function captureExecutionRows(root: HTMLElement | undefined) {
  if (!root || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return [];
  if (import.meta.env.DEV && new URLSearchParams(location.search).get("agentMotion") === "original")
    return [];
  const viewport = root.getBoundingClientRect();
  return [...root.querySelectorAll<HTMLElement>("[data-timeline-row-id]")].flatMap((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > viewport.top && rect.top < viewport.bottom
      ? [{ element, id: element.dataset.timelineRowId, top: rect.top }]
      : [];
  });
}

const rowAnimations = new WeakMap<HTMLElement, Animation>();

export function settleExecutionRows(rows: ReturnType<typeof captureExecutionRows>) {
  if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const { element, id, top } of rows) {
    if (!element.isConnected || element.dataset.timelineRowId !== id) continue;
    rowAnimations.get(element)?.cancel();
    const delta = top - element.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) continue;
    const style = getComputedStyle(element);
    const animation = element.animate([{ translate: `0 ${delta}px` }, { translate: "0 0" }], {
      duration: Number.parseFloat(style.getPropertyValue("--agent-fold-ms")) || 240,
      easing: style.getPropertyValue("--agent-motion-ease").trim() || "ease-out",
    });
    rowAnimations.set(element, animation);
  }
}

// React's pre-commit snapshot measures the old DOM only when work ends.
export class ExecutionMotionBoundary extends Component<{
  identity: string;
  working: boolean;
  listRef: RefObject<LegendListRef | null>;
  children: ReactNode;
}> {
  override getSnapshotBeforeUpdate(previous: Readonly<typeof this.props>) {
    return previous.identity === this.props.identity && previous.working && !this.props.working
      ? captureExecutionRows(this.props.listRef.current?.getScrollableNode())
      : [];
  }
  override componentDidUpdate(
    _previous: Readonly<typeof this.props>,
    _state: unknown,
    snapshot: ReturnType<typeof captureExecutionRows>,
  ) {
    settleExecutionRows(snapshot);
  }
  override render() {
    return this.props.children;
  }
}
