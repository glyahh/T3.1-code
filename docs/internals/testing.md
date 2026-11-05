# Testing

Rules for writing tests, and for asking for them in review. AGENTS.md carries the same writing rules under Verifying; change both together.

## What to test

- Test behavior that can break, such as orchestration and event-sourcing, provider protocol translation, auth and permission guards, persistence and migrations, external-format parsing, race fixes, and the logic a bug fix changed. Leave out tests for what types already guarantee, trivial logic, copy text, smoke runs, mock-call mirrors, callback wiring, and props rendered to static markup.
- Extend before you add. When an existing test or table covers the behavior, add a row or an assertion there. Write a new `it` only when no case fits.
- Test at one layer: the lowest one that fails on `main`. Do not repeat the case in a wrapper test, at each call site, or in web and mobile copies of the same logic.
- In review, ask for a missing test only when it would catch a real regression. Do not ask for one assertion per constant, label, or `switch` case. Flag a new test that breaks the rules above, and name the fix: fold it into the existing case or table, delete it, or keep one layer.
- Backend behavior changes require focused tests for that behavior; test-code retention follows the acceptance cleanup rules below.
- Proof for a bug fix depends on the bug. Logic, data, state, and protocol bugs get a failing test first (the fewest that fail on `main` for that reason, in an existing case of the module's test file where one fits), then the fix. Purely visual bugs (spacing, colour, alignment, a layout shift) get before/after captures as their proof and no test: do not add UI tests for nitpicks, and do not ask for one in review when a capture already shows it. A server-only fix with no visible surface requires focused test evidence plus a short runtime transcript.

### 通用验收标准

每次需求或修复都按下表评估适用范围、场景、通过条件和证据，复用现有测试与夹具，避免在多个层级重复同一断言。不适用必须说明具体理由；用户明确要求的必需项不得自行豁免、降低阈值，或因缺少工具、系统、凭据而改为不适用。

| 类别          | 验证重点与通过依据                                                                  |
| ------------- | ----------------------------------------------------------------------------------- |
| 单元测试      | 函数、类、状态转换和边界；逻辑缺陷先失败、修复后通过。                              |
| 集成测试      | 真实模块、适配器、编排及持久化协作；标识、顺序、数量和终态一致。                    |
| 端到端（E2E） | 从真实客户端操作到后端、结果展示的完整流程；包含成功、失败、停止和恢复。            |
| 冒烟测试      | 启动、核心操作和结果基本可用；构建或启动成功不能代替完整验收。                      |
| 回归测试      | 修改未破坏既有流程、历史数据、逆向操作及其他受影响入口。                            |
| 接口（API）   | 输入、输出、非法参数、权限、未知资源、重复请求、取消及超时正确。                    |
| 契约测试      | 服务及各 SDK 的格式兼容；增量、重复、乱序更新不丢字段或重复执行。                   |
| 性能测试      | 固定环境和样本，对比基线的响应、吞吐、资源及 p95；区分外部模型耗时与本地延迟。      |
| 负载测试      | 正常及高负载并发下稳定；记录速率、持续时间、积压、错误和资源恢复。                  |
| 压力测试      | 逐级加压确定首次失效点；验证卸载后恢复，不在真实账号上寻找极限。                    |
| 安全测试      | 越权、审批绕过、路径穿越、链接越界、恶意输出及凭据泄露。                            |
| 兼容性测试    | 受影响系统、浏览器、客户端与本地/远程连接；没有实际环境证据不能称兼容。             |
| 故障注入      | 断网、超时、进程退出、重复及延迟事件；明确结束或恢复，不重复副作用。                |
| 混沌测试      | 隔离环境组合故障与并发操作；固定随机种子，记录一致性和恢复证据。                    |
| 灰度验证      | 候选版本从隔离数据到少量真实任务，按预定样本和指标观察。                            |
| 金丝雀测试    | 先小范围运行，指标达标才扩展；预定停止和回滚条件。                                  |
| A/B 测试      | 同硬件、配置、夹具和任务交替比较新旧版本，保留原始样本；不将回归通过当作 A/B 完成。 |
| 验收（UAT）   | 逐项重现用户场景，确认实际结果满足需求；未取得反馈标为待验收。                      |

- 实现前确认故障现象和根因，并记录运行路径、构建/资源哈希、实际运行时与仓库版本要求；评估所有受影响客户端、连接模式和注册提供方，不能只验证报错的 SDK。共享缺陷在共享层修，专属兼容留在适配器边界。
- 结果分别标为通过、失败、受阻、未执行、不适用、待验收，并说明范围与原因。跳过、超时、中断、部分通过均不算全通过；既有失败也须记录，归为基线问题需有对照证据。所有必需项通过后才可宣布完整验收完成。
- 证据串联“用户场景/视频时间点 → 复现 → 原因 → 修改 → 检查 → 实际结果”，保存命令、退出码、环境、样本数、脱敏日志及哈希；跨模块用请求/会话/运行/工具标识关联。视觉变化留前后截图，动效留短录屏；证据放工作区外，不提交凭据或测试产物。
- 单元、Replay、组件测试、后端 API 冒烟和真实 SDK 调用分别报告，不能互相冒充 E2E。真实客户端按对应技能验证；工具不可用时遵守技能边界并明确受阻，可由用户操作补充人工 UAT，不能假称自动验证完成。
- 破坏性、故障、负载和压力测试使用隔离状态、项目及免费 Replay；真实 SDK 行为用低成本模型少量验证。不得改写正式数据库、泄露凭据、对真实账号批量压测，或改变模型/思考等级来制造性能改善。
- 对 Agent 活动/流式输出的完整验收，未另行约定时沿用基线：本地事件到展示 p95 ≤200ms；1/4/8 会话、每会话 50 次更新/秒各 15 分钟；组合故障 30 分钟；灰度至少 20 轮、单一提供方金丝雀先 5 轮、可用提供方各 3 轮真实调用；A/B 各 20 次，本地延迟退化不超过 10%。其他需求先确定有意义的指标；性能基准与普通逻辑测试分开，不在单元测试中引入实时时间断言。
- 按当前用户约定，验收收尾清理本次新增测试、压测及故障注入代码，精确撤回本次对原有测试的新增部分；保留原有测试、脱敏结果和用户明确要求保留的回归用例。失败或受阻记录不能随清理消失；清理后重新运行适用检查及构建，确认无新增测试入口或临时凭据。
- 覆盖安装仅在用户授权范围内执行：无运行任务时正常退出，备份原资源和版本记录，保留账号/会话/设置，重启核对运行路径、实际加载资源哈希及冒烟结果；失败恢复备份。完整验收未通过的安装明确标为候选版本，不能称已完整修复；不因新增本规则自动取得发布或安装授权。

## Waiting for work

- The server is event-sourced, and side effects run after the command commits. In tests, drain the effect worker (`OrchestrationEffectWorkerV2.drain`) or await the specific persisted event or `Deferred` that marks the milestone. Never wait on sleeps or polling. A test that needs a timeout to pass is wrong. Concretely:
  - `it.effect` runs on a `TestClock`; `Effect.sleep` only advances through `TestClock.adjust`. `it.live` is wall-clock and only for subprocess or network fixtures.
  - No `yieldNow` or `sleep` polling loops. Await the `Deferred`, take from the `Queue`, or drain the worker.
  - No per-test timeout argument or `retry`. The project timeout is the ceiling, and flaky tests are fixed, not retried.
  - No `performance.now()` or `Date.now()` deltas. Assert on events and counts, not elapsed time.
  - Browser tests assert through `expect.element` or `vi.waitFor`, never `requestAnimationFrame` or `transitionend`.
  - `vi.mock` factories must not spread a real module that pulls in Shiki or the diff workers.
  - `it.skip` and friends need a tracking issue on the line above: `// quarantine: #1234 <why>`.
  - Lint enforces this: `t3code/no-test-timeout-or-unreasoned-skip`, `t3code/no-frame-waits-in-browser-tests`, `t3code/no-wall-clock-in-tests`, `t3code/no-real-time-wait-in-tests`, `t3code/no-polling-loop-in-tests`.

## Web browser tests

- For integrated web verification, follow `test-t3-app` using the current agent application's built-in browser and its browser skill against isolated development state. No T3 Browser tools or dedicated T3 agent session are required. Verify desktop-specific behavior in the actual desktop client using the available desktop-control skill; a browser run establishes web behavior only. Keep the existing acceptance criteria and evidence requirements. Use `test-t3-mobile` for native mobile verification when it is in scope.

- Web browser tests are `*.browser.test.tsx` or `*.browser.test.ts` and render with `await using screen = await render(...)` from `apps/web/test/render.tsx`. `t3code/require-disposable-render` errors on the old patterns.
  - Acquire what the test drives after mounting (fake timers it advances, spies it sets up after mounting) after the render, so it disposes before the unmount. Anything the first render reads comes before it.
  - A helper that renders and then waits or clicks puts the screen in an `AsyncDisposableStack` and `move()`s it out only on success, so a failed wait still unmounts.
  - `rerender` needs a fresh element on every call.
  - No lifecycle hooks and no module-level mutable state. Shared mock state that `vi.mock` factories read is reset by a `setup()` call at the top of the test.
  - `router` is on by default. Pass `router: false` only with a one-line comment saying why.

  ```tsx
  it("saves on Enter", async () => {
    const onSave = vi.fn();
    using _now = vi.spyOn(Date, "now").mockReturnValue(0);
    await using screen = await render(<TitleEditor onSave={onSave} />, { router: "/threads/1" });
    await userEvent.type(screen.getByRole("textbox"), "Title{Enter}");
    expect(onSave).toHaveBeenCalledWith("Title");
  });
  ```
