import { createMemoryHistory } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { ThreadId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
import { DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { getRouter } from "~/router";
import { ENVIRONMENT_ID, PROJECT_ID, type FakeDriver } from "../../test/fakeEnvironment";
import { render } from "../../test/render";

const wire = await vi.hoisted(async () => {
  const { installFakeEnvironment } = await import("../../test/fakeEnvironment");
  const environment = installFakeEnvironment([]);
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  return { environment, fetchSpy };
});

// Only HTTP and socket transports are fake; see test/appScenarios.renders.tsx.
vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (importOriginal) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});

vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

__setClientSettingsForTests({
  ...DEFAULT_CLIENT_SETTINGS,
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
});
const draftId = DraftId.make("draft-27443");
const threadId = ThreadId.make("thread-27443");
useComposerDraftStore
  .getState()
  .setProjectDraftThreadId(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID), draftId, { threadId });

// Route preparation is fixture setup; its work still counts toward the whole gate's deadline.
const router = getRouter(createMemoryHistory({ initialEntries: [`/draft/${draftId}`] }));
await router.load();

it("a new draft does not load its reserved thread before the server lists it", async () => {
  using _environment = wire.environment;
  using fetchSpy = wire.fetchSpy;
  await using _app = await render(<AppRoot router={router} />, {
    // AppRoot brings its own router.
    router: false,
  });
  await expect.element(page.getByTestId("composer-editor")).toBeVisible();
  // The shell snapshot has arrived once the sidebar lists the project, so the connection is up.
  await expect.element(page.getByText("render", { exact: true }).first()).toBeVisible();

  const requestUrls = fetchSpy.mock.calls.map(([input]) =>
    String(input instanceof Request ? input.url : input),
  );
  const threadRequests = requestUrls.filter((url) =>
    url.includes(`/api/orchestration/threads/${threadId}/`),
  );
  // A 404 here marks the thread deleted, and the view never loads it once the send creates it.
  expect(threadRequests).toEqual([]);
});
