import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

export const protectedChangeAllowed = (path, versions) => {
  if (path === ".github/upstream/request.json") return true;
  if (versions.head === versions.base) return true;
  if (
    path.startsWith(".github/upstream/") ||
    path.startsWith("scripts/upstream-") ||
    path.startsWith(".github/workflows/upstream-")
  )
    return false;
  if (path.startsWith(".github/workflows/"))
    return (
      versions.base === versions.common &&
      versions.upstream !== versions.common &&
      versions.head === versions.upstream
    );
  return true;
};

const git = (...args) =>
  NodeChildProcess.execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

export const entries = (sha, paths) => {
  const result = new Map();
  for (let index = 0; index < paths.length; index += 100) {
    const output = git("ls-tree", "-z", sha, "--", ...paths.slice(index, index + 100));
    for (const entry of output.split("\0").filter(Boolean)) {
      const [metadata, path] = entry.split("\t");
      result.set(path, metadata.split(" ")[2]);
    }
  }
  return result;
};

const preservationReport = (baseSha, upstreamSha, headSha) => {
  for (const sha of [baseSha, upstreamSha, headSha])
    if (!/^[a-f0-9]{40}$/.test(sha || "")) throw new Error("Invalid pinned commit");
  const commonSha = git("merge-base", baseSha, upstreamSha);
  const paths = git("diff", "--name-only", "-z", commonSha, baseSha, "--", ".", ":(exclude).repos")
    .split("\0")
    .filter((path) => path && path !== ".github/upstream/request.json");
  const [common, base, upstream, head] = [commonSha, baseSha, upstreamSha, headSha].map((sha) =>
    entries(sha, paths),
  );
  const unchangedByOfficial = [];
  const overlapping = [];
  for (const path of paths) {
    const versions = {
      common: common.get(path) || null,
      base: base.get(path) || null,
      upstream: upstream.get(path) || null,
      head: head.get(path) || null,
    };
    if (versions.common === versions.upstream)
      unchangedByOfficial.push({
        path,
        expected: versions.base,
        actual: versions.head,
        passed: versions.base === versions.head,
      });
    else overlapping.push({ path, ...versions });
  }
  return { baseSha, upstreamSha, headSha, commonSha, unchangedByOfficial, overlapping };
};

if (process.argv[1] && NodeURL.fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = preservationReport(
    process.env.UPSTREAM_BASE_SHA,
    process.env.UPSTREAM_OFFICIAL_SHA,
    process.env.UPSTREAM_HEAD_SHA,
  );
  const output = process.env.EVIDENCE_DIRECTORY;
  if (!output) throw new Error("External evidence directory is required");
  NodeFS.mkdirSync(output, { recursive: true });
  NodeFS.writeFileSync(
    NodePath.join(output, "preservation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const failed = report.unchangedByOfficial.filter((file) => !file.passed);
  console.log(
    JSON.stringify({
      personalOnlyFiles: report.unchangedByOfficial.length,
      failed,
      overlappingFiles: report.overlapping.length,
    }),
  );
  process.exitCode = failed.length > 0 ? 1 : 0;
}
