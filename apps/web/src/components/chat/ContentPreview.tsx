import { createContext, use, useState, useEffect, useRef, type ReactNode } from "react";
import { Maximize2Icon } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogPopup, DialogTitle } from "../ui/dialog";

export const ContentPreviewPinContext = createContext<((open: boolean) => void) | undefined>(
  undefined,
);

export const ContentPreviewContext = createContext(false);

export function ExpandContentButton({
  disabled = false,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="glass"
      size="icon-xs"
      disabled={disabled}
      aria-label="Expand preview"
      title="Expand preview"
      onClick={onClick}
    >
      <Maximize2Icon className="size-3.5" />
    </Button>
  );
}

export function ContentPreview({
  children,
  preview,
  disabled = false,
  onExpand,
  inline = false,
  enabled = true,
  fill = false,
}: {
  children: ReactNode;
  inline?: boolean;
  fill?: boolean;
  enabled?: boolean;
  preview?: ReactNode | (() => ReactNode);
  disabled?: boolean;
  onExpand?: (() => void) | undefined;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const inside = use(ContentPreviewContext);
  const [opened, setOpened] = useState<{ content: ReactNode; trigger: HTMLElement | null } | null>(
    null,
  );
  const pin = use(ContentPreviewPinContext);
  const expanded = opened !== null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- retains the virtual timeline row while its dialog is open and releases on unmount
  useEffect(() => {
    if (!expanded) return;
    pin?.(true);
    return () => pin?.(false);
  }, [expanded, pin]);
  if (inside || !enabled) return children;
  const Root = inline ? "span" : "div";
  return (
    <Root
      className={`group/content-preview relative min-w-0 [&_[role=toolbar]]:pe-8 ${inline ? "inline-block max-w-full" : ""} ${fill ? "h-full" : ""}`}
      data-content-preview=""
    >
      {children}
      <span className="absolute end-1 top-1 z-10 opacity-0 transition-opacity duration-150 group-hover/content-preview:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 motion-reduce:transition-none">
        <ExpandContentButton
          disabled={disabled}
          onClick={() => {
            if (onExpand) onExpand();
            else
              setOpened({
                content: typeof preview === "function" ? preview() : (preview ?? children),
                trigger:
                  document.activeElement instanceof HTMLElement ? document.activeElement : null,
              });
          }}
        />
      </span>
      {opened ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setOpened(null);
          }}
        >
          <DialogPopup
            ref={popupRef}
            initialFocus={() =>
              popupRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close"]') ??
              false
            }
            variant="content-preview"
            bottomStickOnMobile={false}
            finalFocus={() => (opened.trigger?.isConnected ? opened.trigger : false)}
          >
            <DialogTitle className="sr-only">Content preview</DialogTitle>
            <div className="chat-markdown min-h-0 overflow-auto overscroll-contain p-6 pt-10">
              <ContentPreviewContext value={true}>{opened.content}</ContentPreviewContext>
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}
    </Root>
  );
}
