// @effect-diagnostics nodeBuiltinImport:off - Vitest loads reporters outside the Effect runtime.
import * as NodeFS from "node:fs";
import type {
  Reporter,
  TestCase,
  TestModule,
  TestSpecification,
  TestSuite,
} from "vite-plus/test/node";

export function summarizeTestProgress(contents: string) {
  const files = new Map<string, string>();
  const active = new Map<string, { file: string; name: string }>();
  const finished = new Map<string, string>();
  const started = new Map<string, number>();
  const durations = new Map<string, number>();
  let invalidRecords = 0;
  let runner: { pid: number; parentPid: number; createdAtMs: number } | undefined;
  for (const line of contents.split("\n")) {
    if (!line) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      invalidRecords++;
      continue;
    }
    if (typeof event !== "object" || event === null || !("kind" in event)) {
      invalidRecords++;
      continue;
    }
    if (
      event.kind === "process" &&
      "pid" in event &&
      "parentPid" in event &&
      typeof event.pid === "number" &&
      Number.isInteger(event.pid) &&
      event.pid > 0 &&
      typeof event.parentPid === "number" &&
      Number.isInteger(event.parentPid) &&
      event.parentPid > 0 &&
      "createdAtMs" in event &&
      typeof event.createdAtMs === "number" &&
      Number.isFinite(event.createdAtMs) &&
      event.createdAtMs > 0
    ) {
      runner = { pid: event.pid, parentPid: event.parentPid, createdAtMs: event.createdAtMs };
    } else if (event.kind === "run" && "files" in event && Array.isArray(event.files)) {
      for (const file of event.files) if (typeof file === "string") files.set(file, "pending");
    } else if (
      event.kind === "module" &&
      "file" in event &&
      typeof event.file === "string" &&
      "state" in event &&
      typeof event.state === "string"
    ) {
      files.set(event.file, event.state);
      if ("at" in event && typeof event.at === "number") {
        if (event.state === "loading" && !started.has(event.file))
          started.set(event.file, event.at);
        if (event.state === "completed" && started.has(event.file))
          durations.set(event.file, event.at - started.get(event.file)!);
      }
    } else if (
      (event.kind === "case" || event.kind === "suite") &&
      "id" in event &&
      typeof event.id === "string" &&
      "file" in event &&
      typeof event.file === "string" &&
      "name" in event &&
      typeof event.name === "string" &&
      "state" in event &&
      typeof event.state === "string"
    ) {
      if (event.state === "running") active.set(event.id, { file: event.file, name: event.name });
      else {
        active.delete(event.id);
        if (event.kind === "case") finished.set(event.id, event.state);
      }
    }
  }
  return {
    completedFiles: [...files.values()].filter((state) => state === "completed").length,
    totalFiles: files.size,
    completedCases: finished.size,
    failedCases: [...finished.values()].filter((state) => state === "failed").length,
    active: [...active.values()],
    unfinishedFiles: [...files]
      .filter(([, state]) => state !== "completed")
      .map(([file, state]) => ({ file, state })),
    invalidRecords,
    runner,
    slowestFiles: [...durations]
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, durationMs]) => ({ file, durationMs })),
  };
}

export default class CheckTestProgress implements Reporter {
  private readonly file = process.env.T3CODE_CHECK_CHANGED_PROGRESS_FILE;
  private descriptor = this.file ? NodeFS.openSync(this.file, "a") : undefined;
  private write(event: Record<string, unknown>) {
    if (this.descriptor !== undefined)
      NodeFS.writeSync(this.descriptor, `${JSON.stringify({ ...event, at: performance.now() })}\n`);
  }
  onTestRunEnd() {
    if (this.descriptor !== undefined) NodeFS.closeSync(this.descriptor);
    this.descriptor = undefined;
  }
  onInit() {
    this.write({
      kind: "process",
      pid: process.pid,
      parentPid: process.ppid,
      createdAtMs: performance.timeOrigin,
    });
  }
  onTestRunStart(specifications: ReadonlyArray<TestSpecification>) {
    this.write({
      kind: "run",
      files: specifications.map((specification) => specification.moduleId),
    });
  }
  onTestModuleQueued(module: TestModule) {
    this.module(module, "loading");
  }
  onTestModuleStart(module: TestModule) {
    this.module(module, "running");
  }
  onTestModuleEnd(module: TestModule) {
    this.module(module, "completed");
  }
  private module(module: TestModule, state: string) {
    this.write({ kind: "module", file: module.moduleId, state });
    process.stdout.write(`[check:test:file:${state}] ${module.moduleId}\n`);
  }
  onTestCaseReady(test: TestCase) {
    this.test(test, "case", "running");
  }
  onTestCaseResult(test: TestCase) {
    const result = test.result();
    this.test(test, "case", result.state, test.diagnostic()?.duration);
    if (result.state === "failed") {
      for (const error of result.errors) {
        this.write({
          kind: "failure",
          file: test.module.moduleId,
          name: test.fullName,
          message: error.message,
          stack: error.stack,
        });
        process.stderr.write(`[check:test:failed] ${test.fullName}: ${error.message}\n`);
      }
    }
  }
  onTestSuiteReady(suite: TestSuite) {
    this.test(suite, "suite", "running");
  }
  onTestSuiteResult(suite: TestSuite) {
    this.test(suite, "suite", "completed");
  }
  private test(
    test: TestCase | TestSuite,
    kind: "case" | "suite",
    state: string,
    durationMs?: number,
  ) {
    // Worker updates can arrive in batches; callback gaps are not execution durations.
    this.write({
      kind,
      id: test.id,
      file: test.module.moduleId,
      name: test.fullName,
      state,
      durationMs,
    });
  }
}
