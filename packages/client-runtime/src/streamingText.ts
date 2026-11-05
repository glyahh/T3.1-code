// @effect-diagnostics globalTimers:off - this UI display buffer owns a finite timer, stopped by the mounting client.
function scalarEnd(text: string, end: number) {
  const previous = text.charCodeAt(end - 1);
  return previous >= 0xd800 && previous <= 0xdbff ? Math.min(text.length, end + 1) : end;
}

let liveSequence = 0;
const arrivals = new Map<string, number>();
export const liveTextSequence = () => liveSequence;
export function noteLiveText(key: string) {
  if (arrivals.has(key)) return;
  arrivals.set(key, ++liveSequence);
  if (arrivals.size > 2048) arrivals.delete(arrivals.keys().next().value!);
}
export function clearLiveText(prefix: string) {
  for (const key of arrivals.keys()) if (key.startsWith(prefix)) arrivals.delete(key);
}
export const isNewLiveText = (key: string, opened: number) => (arrivals.get(key) ?? 0) > opened;

function displayClusters(text: string) {
  return [
    ...text.matchAll(
      /(?:\p{Regional_Indicator}{2}|[^\p{M}\u200d](?:\p{M}|\p{Emoji_Modifier})*(?:\u200d[^\p{M}](?:\p{M}|\p{Emoji_Modifier})*)*|\p{M}+)/gu,
    ),
  ];
}

export function createStreamingText(text: string, streaming: boolean, natural = false) {
  let target = text;
  let displayed = natural
    ? (displayClusters(text)[0]?.[0] ?? "")
    : streaming
      ? text.slice(0, scalarEnd(text, 1))
      : text;
  let step = 1;
  let timer: (() => void) | undefined;
  let lastFrame = 0;
  let remainingMs = 1000;
  let credit = 0;
  let remainingTicks = 60;
  const listeners = new Set<() => void>();
  const publish = (value: string) => {
    if (value === displayed) return;
    displayed = value;
    for (const listener of listeners) listener();
  };
  const stop = () => {
    timer?.();
    timer = undefined;
  };
  const flush = () => {
    stop();
    publish(target);
  };
  const schedule = () => {
    if (timer !== undefined || displayed === target) return;
    const tick = () => {
      timer = undefined;
      let end = Math.min(target.length, displayed.length + step);
      if (natural) {
        const tail = displayClusters(target.slice(displayed.length));
        let count = Math.max(3, Math.ceil(tail.length / Math.max(1, remainingTicks--)));
        if (typeof globalThis.requestAnimationFrame === "function") {
          const now = performance.now();
          const elapsed = Math.max(1, now - lastFrame);
          lastFrame = now;
          remainingMs -= elapsed;
          credit += elapsed * 0.15;
          count = Math.max(
            Math.floor(credit),
            remainingMs <= 0 ? tail.length : Math.floor((tail.length * elapsed) / remainingMs),
          );
          credit %= 1;
        }
        end = displayed.length + (tail[count]?.index ?? target.length - displayed.length);
      }
      publish(target.slice(0, scalarEnd(target, end)));
      schedule();
    };
    if (natural && typeof globalThis.requestAnimationFrame === "function") {
      const id = requestAnimationFrame(tick);
      timer = () => cancelAnimationFrame(id);
    } else {
      const id = setTimeout(tick, natural ? 20 : 32);
      timer = () => clearTimeout(id);
    }
  };
  return {
    getSnapshot: () => displayed,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (next: string, animate: boolean, nextNatural = natural) => {
      natural = nextNatural;
      target = next;
      if (!animate || !target.startsWith(displayed)) {
        flush();
        return;
      }
      // A burst catches up within five ticks without delaying persistence or tool events.
      step = Math.max(1, Math.ceil((target.length - displayed.length) / 5));
      if (timer === undefined) {
        remainingTicks = 50;
        remainingMs = 1000;
        credit = 0;
        lastFrame = typeof performance !== "undefined" ? performance.now() : 0;
      }
      schedule();
    },
    stop,
    flush,
  };
}
