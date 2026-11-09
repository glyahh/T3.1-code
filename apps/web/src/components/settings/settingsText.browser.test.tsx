import { expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import { SettingsTextProvider } from "./SettingsTextProvider";
import { useSettingsText } from "./settingsText";

function SharedSettingsControl() {
  const text = useSettingsText();
  return <button type="button">{text("Copy version {0}", "v6")}</button>;
}

it("keeps shared UI in English outside settings, including after the localized subtree unmounts", async () => {
  await using screen = await render(
    <>
      <SharedSettingsControl />
      <SettingsTextProvider>
        <SharedSettingsControl />
      </SettingsTextProvider>
    </>,
  );
  await expect.element(screen.getByRole("button", { name: "Copy version v6" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "复制版本 v6" })).toBeVisible();
  await screen.rerender(<SharedSettingsControl />);
  await expect.element(screen.getByRole("button", { name: "Copy version v6" })).toBeVisible();
});
