import * as NodeAssert from "node:assert/strict";
import * as NodeTest from "node:test";
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import {
  evidenceComplete,
  parseRequest,
  requestKey,
  resolveRepository,
  stableReleases,
  summarizeChanges,
  task,
} from "../../scripts/upstream-sync.mjs";

NodeTest.test("repository identity survives a rename and rejects another fork", () => {
  const policy = { repositoryId: 1441172085, repository: "glyahh/t3code" };
  const environment = {
    GITHUB_REPOSITORY_ID: "1441172085",
    GITHUB_REPOSITORY: "glyahh/T3.1-code",
  };
  NodeAssert.equal(resolveRepository(policy, environment), "glyahh/T3.1-code");
  NodeAssert.equal(
    resolveRepository(policy, { ...environment, GITHUB_REPOSITORY: "glyahh/another-name" }),
    "glyahh/another-name",
  );
  NodeAssert.throws(
    () => resolveRepository(policy, { ...environment, GITHUB_REPOSITORY_ID: "123" }),
    /trusted repository/,
  );
  NodeAssert.throws(() => resolveRepository(policy, {}), /trusted repository/);
  NodeAssert.throws(
    () => resolveRepository(policy, { ...environment, GITHUB_REPOSITORY: "../another/repo" }),
    /repository name/,
  );
});

NodeTest.test("large release summaries stay bounded without omitting the total", () => {
  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-upstream-summary-"));
  const git = (...args) =>
    NodeChildProcess.execFileSync(
      "git",
      [
        "-C",
        directory,
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        ...args,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  try {
    git("init", "--quiet");
    git("commit", "--quiet", "--allow-empty", "-m", "base");
    const base = git("rev-parse", "HEAD");
    for (let index = 0; index < 250; index++)
      NodeFS.writeFileSync(NodePath.join(directory, `file-${index}.txt`), "changed\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "release");
    const summary = summarizeChanges(base, git("rev-parse", "HEAD"), directory);
    NodeAssert.ok(summary.split("\n").length <= 102);
    NodeAssert.match(summary, /250 files changed/);
  } finally {
    NodeAssert.equal(NodePath.dirname(directory), NodePath.resolve(NodeOS.tmpdir()));
    NodeAssert.ok(NodePath.basename(directory).startsWith("t3-upstream-summary-"));
    NodeFS.rmSync(directory, { recursive: true, force: true });
  }
});

NodeTest.test("cloud dispatch never invokes the legacy bot for Work Cloud", () => {
  const request = {
    key: "request",
    personalSha: "personal",
    upstreamSha: "upstream",
    policyHash: "policy",
  };
  const policy = { maxRounds: 2 };
  NodeAssert.equal(task(request, policy, 2, 1).startsWith("@codex "), true);
  const handoff = task(request, policy, 2, 1, "work-cloud");
  NodeAssert.equal(handoff.includes("@codex"), false);
  NodeAssert.equal(handoff.startsWith("<!-- t3-work-cloud:request -->"), true);
  NodeAssert.throws(() => task(request, policy, 2, 1, "unknown"), /Unknown cloud executor/);
});

NodeTest.test("stable queue rejects previews and orders numeric versions", () => {
  const release = (tag_name, extra = {}) => ({ tag_name, ...extra });
  const rows = [
    release("v1.10.0"),
    release("v1.2.0"),
    release("v1.3.0-nightly.1"),
    release("v1.4.0", { prerelease: true }),
    release("v1.5.0", { draft: true }),
    release("../../main"),
  ];
  NodeAssert.deepEqual(
    stableReleases(rows).map((r) => r.tag_name),
    ["v1.2.0", "v1.10.0"],
  );
});

NodeTest.test("idempotency changes with either SHA or trusted policy", () => {
  const key = requestKey("upstream", "personal", "policy");
  NodeAssert.equal(key, requestKey("upstream", "personal", "policy"));
  for (const values of [
    ["new", "personal", "policy"],
    ["upstream", "new", "policy"],
    ["upstream", "personal", "new"],
  ])
    NodeAssert.notEqual(key, requestKey(...values));
});

NodeTest.test("validation rejects stale, missing, skipped and unsupported evidence", () => {
  const report = {
    baseSha: "base",
    headSha: "head",
    evidence: { e2e: { status: "passed", urls: ["https://github.com/example/evidence"] } },
  };
  NodeAssert.equal(evidenceComplete(report, ["e2e"], "base", "head"), true);
  NodeAssert.equal(evidenceComplete(report, ["e2e"], "other", "head"), false);
  NodeAssert.equal(evidenceComplete(report, ["e2e"], "base", "new"), false);
  NodeAssert.equal(evidenceComplete(report, ["e2e", "uat"], "base", "head"), false);
  for (const status of ["skipped", "blocked", "failed", "pending"])
    NodeAssert.equal(
      evidenceComplete(
        { ...report, evidence: { e2e: { ...report.evidence.e2e, status } } },
        ["e2e"],
        "base",
        "head",
      ),
      false,
    );
  NodeAssert.equal(
    evidenceComplete(
      { ...report, evidence: { e2e: { status: "passed", urls: [] } } },
      ["e2e"],
      "base",
      "head",
    ),
    false,
  );
});

NodeTest.test("request metadata round trips and absent metadata is not a managed request", () => {
  const request = { upstreamSha: "a", personalSha: "b", key: "c" };
  NodeAssert.deepEqual(
    parseRequest(`<!-- t3-upstream:${Buffer.from(JSON.stringify(request)).toString("base64")} -->`),
    request,
  );
  NodeAssert.equal(parseRequest("ordinary PR"), undefined);
});
