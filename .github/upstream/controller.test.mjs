import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evidenceComplete,
  parseRequest,
  requestKey,
  stableReleases,
} from "../../scripts/upstream-sync.mjs";

test("stable queue rejects previews and orders numeric versions", () => {
  const release = (tag_name, extra = {}) => ({ tag_name, ...extra });
  const rows = [
    release("v1.10.0"),
    release("v1.2.0"),
    release("v1.3.0-nightly.1"),
    release("v1.4.0", { prerelease: true }),
    release("v1.5.0", { draft: true }),
    release("../../main"),
  ];
  assert.deepEqual(
    stableReleases(rows).map((r) => r.tag_name),
    ["v1.2.0", "v1.10.0"],
  );
});

test("idempotency changes with either SHA or trusted policy", () => {
  const key = requestKey("upstream", "personal", "policy");
  assert.equal(key, requestKey("upstream", "personal", "policy"));
  for (const values of [
    ["new", "personal", "policy"],
    ["upstream", "new", "policy"],
    ["upstream", "personal", "new"],
  ])
    assert.notEqual(key, requestKey(...values));
});

test("validation rejects stale, missing, skipped and unsupported evidence", () => {
  const report = {
    baseSha: "base",
    headSha: "head",
    evidence: { e2e: { status: "passed", urls: ["https://github.com/example/evidence"] } },
  };
  assert.equal(evidenceComplete(report, ["e2e"], "base", "head"), true);
  assert.equal(evidenceComplete(report, ["e2e"], "other", "head"), false);
  assert.equal(evidenceComplete(report, ["e2e"], "base", "new"), false);
  assert.equal(evidenceComplete(report, ["e2e", "uat"], "base", "head"), false);
  for (const status of ["skipped", "blocked", "failed", "pending"])
    assert.equal(
      evidenceComplete(
        { ...report, evidence: { e2e: { ...report.evidence.e2e, status } } },
        ["e2e"],
        "base",
        "head",
      ),
      false,
    );
  assert.equal(
    evidenceComplete(
      { ...report, evidence: { e2e: { status: "passed", urls: [] } } },
      ["e2e"],
      "base",
      "head",
    ),
    false,
  );
});

test("request metadata round trips and absent metadata is not a managed request", () => {
  const request = { upstreamSha: "a", personalSha: "b", key: "c" };
  assert.deepEqual(
    parseRequest(`<!-- t3-upstream:${Buffer.from(JSON.stringify(request)).toString("base64")} -->`),
    request,
  );
  assert.equal(parseRequest("ordinary PR"), undefined);
});
