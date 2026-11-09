import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  REASONING_SELECT_DESCRIPTOR_IDS,
  selectableProviderOptionChoices,
} from "@t3tools/client-runtime/model-traits";
import { useTraitsSelection, type TraitsSelectionInput } from "./TraitsPicker";
import { useStableCallback } from "../../hooks/useStableCallback";

export function EffortWheelControl({
  traits,
  disabled,
  scope,
  children,
}: {
  traits: TraitsSelectionInput;
  disabled: boolean;
  scope: string;
  children: ReactNode;
}) {
  const selection = useTraitsSelection(traits);
  const descriptor = selection.selectDescriptors.find((d) =>
    REASONING_SELECT_DESCRIPTOR_IDS.has(d.id),
  );
  const excluded = new Set([
    "max",
    "ultracode",
    "ultrathink",
    ...(descriptor?.promptInjectedValues ?? []),
  ]);
  const choices = descriptor
    ? selectableProviderOptionChoices(descriptor).filter((o) => !excluded.has(o.id))
    : [];
  const value = descriptor ? selection.selectValue(descriptor) : "";
  const index = choices.findIndex((o) => o.id === value);
  const enabled =
    !disabled &&
    !selection.modelIsUnavailable &&
    !selection.ultrathinkPromptControlled &&
    index >= 0 &&
    choices.length > 1;
  const host = useRef<HTMLSpanElement>(null);
  const direction = useRef(0);
  const motion = useRef<Animation[]>([]);
  const old = useRef<HTMLElement | null>(null);
  const apply = useStableCallback((step: number) => {
    if (!enabled || !descriptor) return false;
    const next = choices[Math.max(0, Math.min(choices.length - 1, index + step))];
    if (next && next.id !== value) {
      direction.current = step;
      old.current = host.current
        ?.querySelector<HTMLElement>("[data-effort-motion]")
        ?.cloneNode(true) as HTMLElement | null;
      selection.changeSelect(descriptor, next.id);
    }
    return true;
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- binds a cancellable native wheel listener to the actual model button
  useEffect(() => {
    const button = host.current?.querySelector<HTMLButtonElement>(
      "[data-chat-provider-model-picker]",
    );
    if (!button) return;
    let sum = 0,
      last = 0,
      changed = -Infinity;
    const reset = () => {
      sum = 0;
      last = 0;
      changed = -Infinity;
    };
    const wheel = (event: WheelEvent) => {
      if (
        button.disabled ||
        button.hasAttribute("data-popup-open") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      const now = event.timeStamp;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (now - last > 200 || Math.sign(delta) !== Math.sign(sum)) sum = 0;
      last = now;
      if (now - changed < 160) return;
      sum += delta;
      if (Math.abs(sum) < 40) return;
      apply(sum < 0 ? 1 : -1);
      sum = 0;
      changed = now;
    };
    button.addEventListener("wheel", wheel, { passive: false });
    button.addEventListener("pointerleave", reset);
    return () => {
      button.removeEventListener("wheel", wheel);
      button.removeEventListener("pointerleave", reset);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- scope changes must discard accumulated input
  }, [scope, enabled, apply]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- runs finite DOM animations after the selected effort commits and cancels them on replacement
  useLayoutEffect(() => {
    const node = host.current?.querySelector<HTMLElement>("[data-effort-motion]");
    const previous = old.current;
    old.current = null;
    if (
      !node ||
      !previous ||
      !direction.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    motion.current.forEach((a) => a.cancel());
    const step = direction.current;
    direction.current = 0;
    previous.style.position = "absolute";
    previous.style.inset = "0";
    previous.setAttribute("aria-hidden", "true");
    node.parentElement?.append(previous);
    const options = { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" };
    const outgoing = previous.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: `translateY(${-step * 0.35}em)`, opacity: 0 },
      ],
      options,
    );
    const incoming = node.animate(
      [
        { transform: `translateY(${step * 0.35}em)`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      options,
    );
    motion.current = [outgoing, incoming];
    outgoing.onfinish = () => previous.remove();
    return () => {
      outgoing.cancel();
      incoming.cancel();
      previous.remove();
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- selection and scope commits define animation lifetime
  }, [value, scope]);
  return (
    <span ref={host} className="contents">
      {children}
    </span>
  );
}
