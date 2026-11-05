import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useReduceMotionEnabled } from "../../lib/appState";
import { createStreamingText } from "@t3tools/client-runtime/streaming-text";

export function useStreamingText(
  text: string,
  streaming: boolean,
  active: boolean,
  natural = false,
  phaseKnown = false,
) {
  const reduced = useReduceMotionEnabled();
  const [initialNatural] = useState(natural);
  const [buffer] = useState(() => createStreamingText(text, streaming, natural));
  const displayed = useSyncExternalStore(buffer.subscribe, buffer.getSnapshot);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- synchronizes incoming snapshots with the finite display timer
  useLayoutEffect(() => {
    buffer.update(
      text,
      active && !reduced && AppState.currentState === "active",
      phaseKnown ? natural : initialNatural,
    );
  }, [buffer, text, active, reduced, natural, phaseKnown, initialNatural]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- flushes the display timer on native app state changes and releases it on unmount
  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => buffer.flush());
    return () => {
      buffer.stop();
      subscription.remove();
    };
  }, [buffer]);
  return displayed;
}
