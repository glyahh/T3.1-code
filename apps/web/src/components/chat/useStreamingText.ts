import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createStreamingText } from "@t3tools/client-runtime/streaming-text";

export function useStreamingText(
  identity: string,
  text: string,
  streaming: boolean,
  active: boolean,
  natural = false,
  phaseKnown = false,
) {
  const [state, setState] = useState(() => ({
    identity,
    natural,
    buffer: createStreamingText(text, streaming, natural),
  }));
  if (state.identity !== identity) {
    setState({ identity, natural, buffer: createStreamingText(text, streaming, natural) });
  }
  const buffer = state.buffer;
  const displayed = useSyncExternalStore(buffer.subscribe, buffer.getSnapshot);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- synchronizes incoming snapshots with the finite display timer
  useLayoutEffect(() => {
    buffer.update(
      text,
      active && !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      phaseKnown ? natural : state.natural,
    );
  }, [buffer, text, active, natural, phaseKnown, state.natural]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- flushes and releases display timers when browser visibility or motion preferences change
  useEffect(() => {
    const flush = () => buffer.flush();
    document.addEventListener("visibilitychange", flush);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.addEventListener("change", flush);
    return () => {
      buffer.stop();
      document.removeEventListener("visibilitychange", flush);
      reduced.removeEventListener("change", flush);
    };
  }, [buffer]);
  return displayed;
}
