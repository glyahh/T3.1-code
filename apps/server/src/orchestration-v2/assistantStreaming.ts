import type { ResponseStreamingMode } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Queue from "effect/Queue";
import * as Semaphore from "effect/Semaphore";
import * as Clock from "effect/Clock";
import * as Exit from "effect/Exit";
import {
  makeLiveStreamBudget,
  type RetainedLiveItem,
  type LiveStreamBufferError,
} from "./LiveStreamBudget.ts";
import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";

// List fences can open at any indentation; closers may be at most three spaces deeper.
const MARKDOWN_FENCE_PATTERN = /^( *)(`{3,}|~{3,})/;
// CommonMark blank lines contain only spaces and tabs.
const BLANK_LINE_PATTERN = /^[ \t]*$/;
// Require trailing space so partial list markers cannot match during streaming.
const LIST_ITEM_START_PATTERN = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]/;
const SECTION_TITLE_PATTERN = /^ {0,3}(?:#{1,6}(?:[ \t]|$)|\*\*(?:[^*]|\*(?!\*))+\*\*:?$)/;
// Unindented ATX headings end preceding paragraphs and lists without blank lines; bold lines do not.
const TOP_LEVEL_HEADING_PATTERN = /^#{1,6}(?:[ \t]|$)/;

/** Emit terminated lines only, except partial list-start lookahead for tight lists. Hold section titles until content follows. */
export function splitBufferedAssistantText(text: string): { ready: string; rest: string } {
  let openFence: { marker: string; indent: number } | null = null;
  let boundary = -1;
  let lineStart = 0;
  let titleAwaitingContent = false;
  for (;;) {
    const newline = text.indexOf("\n", lineStart);
    const line = text
      .slice(lineStart, newline === -1 ? text.length : newline)
      .replace(/[ \t\r]+$/, "");
    if (
      openFence === null &&
      lineStart > 0 &&
      !titleAwaitingContent &&
      LIST_ITEM_START_PATTERN.test(line)
    ) {
      boundary = lineStart;
    }
    if (newline === -1) {
      break;
    }
    const fenceMatch = MARKDOWN_FENCE_PATTERN.exec(line);
    if (fenceMatch) {
      const indent = fenceMatch[1]!.length;
      const marker = fenceMatch[2]!;
      if (openFence === null) {
        openFence = { marker, indent };
        titleAwaitingContent = false;
      } else if (
        marker[0] === openFence.marker[0] &&
        marker.length >= openFence.marker.length &&
        indent <= openFence.indent + 3 &&
        line.length === indent + marker.length
      ) {
        // CommonMark: a closing fence carries no info string.
        openFence = null;
        boundary = newline + 1;
      }
    } else if (openFence === null && BLANK_LINE_PATTERN.test(line) && lineStart > 0) {
      if (!titleAwaitingContent) {
        boundary = newline + 1;
      }
    } else if (openFence === null) {
      if (lineStart > 0 && !titleAwaitingContent && TOP_LEVEL_HEADING_PATTERN.test(line)) {
        boundary = lineStart;
      }
      titleAwaitingContent = SECTION_TITLE_PATTERN.test(line);
    }
    lineStart = newline + 1;
  }
  if (boundary === -1) {
    return { ready: "", rest: text };
  }
  return { ready: text.slice(0, boundary), rest: text.slice(boundary) };
}

export function makeAssistantStreamingFilter(mode: ResponseStreamingMode) {
  const delivered = new Map<string, { text: string; at: number }>();
  return (
    event: ProviderAdapter.ProviderAdapterV2Event,
    now: number,
  ): ProviderAdapter.ProviderAdapterV2Event | null => {
    if (
      event.type === "node.updated" &&
      event.node.kind === "assistant_message" &&
      event.node.status === "running"
    )
      return null;
    const message =
      event.type === "message.updated" && event.message.role === "assistant"
        ? event.message
        : event.type === "turn_item.updated" &&
            (event.turnItem.type === "assistant_message" || event.turnItem.type === "reasoning")
          ? event.turnItem
          : null;
    if (!message) return event;
    const key = `${event.type}:${message.id}`;
    if (!message.streaming) {
      delivered.delete(key);
      return event;
    }
    if (mode === "live") return event;
    if (mode === "turn") return null;
    const previous = delivered.get(key);
    if (previous && now - previous.at < 400) return null;
    const { ready } = splitBufferedAssistantText(message.text);
    if (!ready || ready === previous?.text) return null;
    delivered.set(key, { text: ready, at: now });
    if (event.type === "message.updated")
      return { ...event, message: { ...event.message, text: ready } };
    if (
      event.type === "turn_item.updated" &&
      (event.turnItem.type === "assistant_message" || event.turnItem.type === "reasoning")
    )
      return { ...event, turnItem: { ...event.turnItem, text: ready } };
    return event;
  };
}

function liveMessageKey(event: ProviderAdapter.ProviderAdapterV2Event): string | null {
  if (
    event.type === "message.updated" &&
    event.message.role === "assistant" &&
    event.message.streaming
  )
    return `message:${event.message.id}`;
  if (
    event.type === "turn_item.updated" &&
    (event.turnItem.type === "assistant_message" || event.turnItem.type === "reasoning") &&
    event.turnItem.streaming
  )
    return `item:${event.turnItem.id}`;
  return null;
}

export function coalesceLiveAssistantEvents<E, R>(
  source: Stream.Stream<ProviderAdapter.ProviderAdapterV2Event, E, R>,
) {
  return Stream.unwrap(
    Effect.gen(function* () {
      const scope = yield* Effect.scope;
      const budget = yield* makeLiveStreamBudget({ maxItems: 512 });
      const output = yield* Queue.bounded<
        RetainedLiveItem<ProviderAdapter.ProviderAdapterV2Event>,
        E | LiveStreamBufferError | import("effect/Cause").Done
      >(512);
      const emit = (event: ProviderAdapter.ProviderAdapterV2Event) =>
        budget.retain(event).pipe(Effect.flatMap((retained) => Queue.offer(output, retained)));
      const mutex = yield* Semaphore.make(1);
      const pending = new Map<string, ProviderAdapter.ProviderAdapterV2Event>();
      const lastSent = new Map<string, number>();
      const timers = new Set<string>();
      let closed = false;
      const flush = Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        for (const [key, event] of pending) {
          yield* emit(event);
          lastSent.set(key, now);
        }
        pending.clear();
      });
      const flushKey = (key: string): Effect.Effect<void, LiveStreamBufferError> =>
        Effect.suspend(() =>
          mutex
            .withPermits(1)(
              Effect.gen(function* () {
                const event = pending.get(key);
                if (closed || event === undefined) {
                  timers.delete(key);
                  return 0;
                }
                const now = yield* Clock.currentTimeMillis;
                const remaining = 50 - (now - (lastSent.get(key) ?? -Infinity));
                if (remaining > 0) return remaining;
                pending.delete(key);
                timers.delete(key);
                lastSent.set(key, now);
                yield* emit(event);
                return 0;
              }),
            )
            .pipe(
              Effect.flatMap((remaining) =>
                remaining > 0
                  ? Effect.sleep(`${remaining} millis`).pipe(Effect.andThen(flushKey(key)))
                  : Effect.void,
              ),
            ),
        );
      const offer = (event: ProviderAdapter.ProviderAdapterV2Event) =>
        mutex.withPermits(1)(
          Effect.gen(function* () {
            if (closed) return;
            const key = liveMessageKey(event);
            const now = yield* Clock.currentTimeMillis;
            if (key === null) {
              yield* flush;
              yield* emit(event);
              return;
            }
            if (now - (lastSent.get(key) ?? -Infinity) >= 50) {
              pending.delete(key);
              lastSent.set(key, now);
              yield* emit(event);
            } else {
              pending.set(key, event);
              if (!timers.has(key)) {
                timers.add(key);
                yield* Effect.sleep("50 millis").pipe(
                  Effect.andThen(flushKey(key)),
                  Effect.ignore,
                  Effect.forkIn(scope),
                );
              }
            }
          }),
        );
      yield* source.pipe(
        Stream.runForEach(offer),
        Effect.exit,
        Effect.flatMap((exit) =>
          mutex.withPermits(1)(
            Effect.gen(function* () {
              yield* flush;
              closed = true;
              if (Exit.isFailure(exit)) yield* Queue.failCause(output, exit.cause);
              else yield* Queue.end(output);
            }),
          ),
        ),
        Effect.catchCause((cause) => {
          closed = true;
          return Queue.failCause(output, cause);
        }),
        Effect.forkScoped({ startImmediately: true }),
      );
      return budget.deliver(Stream.fromQueue(output));
    }),
  );
}
