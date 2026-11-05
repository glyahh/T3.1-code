---
name: test-t3-app
description: Test T3 Code's web UI in the current agent application's built-in browser against isolated development state, and desktop-specific behavior in the actual desktop client. Use for browser verification, pairing recovery, and test fixtures. Use test-t3-mobile for native mobile verification.
---

# Test T3 web and desktop

Use the current agent application's built-in browser for web verification;
in Codex, use its in-app Browser. Read and follow the available browser-control
skill before connecting. No T3 preview tools, Browser panel, or dedicated T3
agent session are required. Do not start a paid agent turn just to obtain
browser access.

Use the available desktop-control skill for desktop-specific behavior in the
actual desktop client. A browser pass verifies the web UI, not Electron shell
or IPC behavior. For native mobile testing, use
[test-t3-mobile](../test-t3-mobile/SKILL.md) when mobile is in scope.

## Start the app

Reuse this task's healthy dev server. Otherwise run `vp run dev` from the
repository root and retain its terminal session. Use the worktree's ignored
`.t3` state and read the actual ports and pairing URL from the dev-runner output.
Never run against `~/.t3/userdata` or set `VITE_HTTP_URL` or `VITE_WS_URL`.

Test with meaningful project and thread data. Read
[references/sqlite-fixtures.md](references/sqlite-fixtures.md) only when
inspecting or seeding SQLite. Stop the test server before direct fixture writes.

## Drive agent turns for free

Do not spend a paid model to see a turn render. `vp run dev` registers the
`Replay (dev)` provider, which replays recorded turns with simulated streaming
through the real adapter and orchestration. Its models are scenarios:
`showcase` covers thinking, a plan, tool calls, an approval, and markdown.
Use the replay picker (`Ctrl+Alt+Shift+R`; GNOME may intercept it for screen
recording), or run
`node apps/server/src/bin.ts thread start --base-dir .t3 --provider devReplay --model showcase <project> "go"`.
When the test needs real provider behavior, use that provider's cheapest
model, such as Haiku for Claude or Luna for Codex.

## Use the in-app browser

Connect directly through the browser-control skill's supported tools. Open a
tab and navigate to this test environment's complete startup pairing URL once,
then reuse that tab for inspection, interaction, and screenshots. If the token
was consumed or expired, run `node apps/server/src/bin.ts pair` against the
same isolated development state for a fresh one. Never consume a pairing link
reserved for the user or expose tokens in evidence.

If the built-in browser cannot connect, follow its skill's supported recovery
steps and report the specific unavailable capability. Continue independent
checks; mark only the affected acceptance items blocked. Missing T3 preview
tools alone is not a blocker. Do not install another automation system or
create a paid T3 agent session to work around browser access.

## Verify and retain

Exercise the affected flow, including success, failure, stop, and recovery
where applicable. Preserve the repository's acceptance thresholds and retain
before/after screenshots for visual changes and short recordings for motion.
Use only supported capture capabilities; if recording or native-client control
is unavailable, report that evidence as blocked rather than substituting a
static screenshot or a web pass.

Keep the server, state, and browser tab available while the user inspects or
iterates. An assistant turn ending is not teardown. Stop only processes you
started, using retained terminal sessions or captured PIDs.

When sharing is requested, start with `vp run dev --share` and give the user
a fresh complete pairing URL that you have not consumed. Keep other credentials
out of screenshots, commits, and replies.
