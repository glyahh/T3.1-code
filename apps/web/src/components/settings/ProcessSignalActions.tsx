import { useSettingsText } from "./settingsText";
import type { ServerProcessSignal } from "@t3tools/contracts";

import { InlineButton } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function ProcessSignalActions({
  disabled,
  onSignal,
}: {
  disabled: boolean;
  onSignal: (signal: ServerProcessSignal) => void;
}) {
  const settingsText = useSettingsText();

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={settingsText("Send SIGINT")}
              tone="muted"
              onClick={() => onSignal("SIGINT")}
            >
              {settingsText("INT")}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{settingsText("Send SIGINT")}</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={settingsText("Send SIGKILL")}
              tone="destructive"
              onClick={() => onSignal("SIGKILL")}
            >
              {settingsText("KILL")}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{settingsText("Send SIGKILL")}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
