import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { digest, parseRequest } from "./upstream-sync.mjs";

const trusted = process.env.TRUSTED_DIRECTORY;
const output = process.env.EVIDENCE_DIRECTORY;
if (!trusted || !output)
  throw new Error("Trusted control and external evidence directories are required");
mkdirSync(output, { recursive: true });
const policyText = readFileSync(resolve(trusted, ".github/upstream/policy.json"), "utf8");
const policy = JSON.parse(policyText);
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const pr = event.pull_request;
const request = parseRequest(pr?.body);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const headSha = git("rev-parse", "HEAD");
const baseSha = pr?.base.sha;
const report = {
  baseSha,
  headSha,
  policyHash: digest(policyText),
  run: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  checks: [],
  evidence: Object.fromEntries(
    policy.requiredEvidence.map((name) => [
      name,
      { status: "blocked", reason: "尚无绑定当前提交的独立云端证据" },
    ]),
  ),
};
const check = (name, command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, timeout: 1_200_000 });
  writeFileSync(resolve(output, `${name}.log`), `${result.stdout || ""}\n${result.stderr || ""}`);
  const passed = result.status === 0 && !result.error;
  report.checks.push({
    name,
    command: [command, ...args],
    exitCode: result.status,
    status: passed ? "passed" : "failed",
  });
  return passed;
};
try {
  if (
    !request ||
    request.personalSha !== baseSha ||
    request.policyHash !== report.policyHash ||
    headSha !== pr.head.sha ||
    pr.head.repo.full_name !== policy.repository
  )
    throw new Error("请求、个人基线、策略或候选 SHA 不匹配，旧验证无效");
  if (!/^v\d+\.\d+\.\d+$/.test(request.tag) || !/^[a-f0-9]{40}$/.test(request.upstreamSha))
    throw new Error("Invalid upstream pin");
  git(
    "fetch",
    "--no-tags",
    `https://github.com/${policy.upstream}.git`,
    `refs/tags/${request.tag}`,
  );
  if (git("rev-parse", "FETCH_HEAD^{commit}") !== request.upstreamSha)
    throw new Error("官方标签已移动，必须重新评估");
  const paths = git("diff", "--name-only", baseSha, headSha).split("\n");
  const protectedPaths = [".github/workflows/", ".github/upstream/", "scripts/upstream-"];
  if (
    paths.some(
      (path) =>
        path !== ".github/upstream/request.json" &&
        protectedPaths.some((prefix) => path.startsWith(prefix)),
    )
  )
    throw new Error("候选修改了受保护的工作流或门禁，须独立审阅");
  if (request.canary) {
    check("controller", "node", [
      "--test",
      resolve(trusted, ".github/upstream/controller.test.mjs"),
    ]);
    report.connection = "云端回写候选已进入独立验证；请审阅 Codex 任务链接后再启用定时";
  } else {
    git("merge-base", "--is-ancestor", request.upstreamSha, headSha);
    const baselineTests = git("diff", "--name-only", "--diff-filter=D", baseSha, headSha).split(
      "\n",
    );
    if (baselineTests.some((path) => /\.test\.[cm]?[jt]sx?$/.test(path)))
      throw new Error("候选删除了既有测试，必须独立审阅");
    const vp = process.platform === "win32" ? "vp.exe" : "vp";
    check("changed", vp, ["run", "check:changed", baseSha]);
    check("build", vp, ["run", "build:desktop"]);
    for (const suite of policy.verification) {
      if (!/^[a-z0-9-]+$/.test(suite.name) || !Array.isArray(suite.args))
        throw new Error("Invalid trusted verification suite");
      const passed = check(suite.name, suite.command, suite.args);
      for (const category of suite.categories) {
        if (!policy.requiredEvidence.includes(category))
          throw new Error("Unknown evidence category");
        const previous = report.evidence[category];
        report.evidence[category] = {
          status: passed && previous.status !== "failed" ? "passed" : "failed",
          urls: [report.run],
          suites: [...(previous.suites || []), suite.name],
        };
      }
    }
  }
} catch (error) {
  report.error = error.message;
} finally {
  writeFileSync(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "## 上游同步验证",
    `个人基线：${baseSha}`,
    `候选：${headSha}`,
    ...report.checks.map((item) => `- ${item.name}: ${item.status}（退出码 ${item.exitCode}）`),
    ...Object.entries(report.evidence).map(
      ([name, item]) => `- ${name}: ${item.status} — ${item.reason}`,
    ),
    report.error || "实际客户端、多平台、性能及人工验收尚未齐备，保持草稿。",
  ];
  writeFileSync(resolve(output, "report.md"), `${lines.join("\n\n")}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n\n"));
  process.exitCode =
    report.error ||
    request?.canary ||
    report.checks.some((item) => item.status !== "passed") ||
    !policy.requiredEvidence.every((name) => report.evidence[name].status === "passed")
      ? 1
      : 0;
}
