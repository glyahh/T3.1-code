import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const stableReleases = (releases) =>
  releases
    .filter(
      (release) =>
        !release.draft && !release.prerelease && /^v\d+\.\d+\.\d+$/.test(release.tag_name),
    )
    .sort((a, b) =>
      a.tag_name
        .slice(1)
        .split(".")
        .map(Number)
        .reduce((order, n, i) => order || n - Number(b.tag_name.slice(1).split(".")[i]), 0),
    );

export const digest = (value) => createHash("sha256").update(value).digest("hex");
export const requestKey = (upstreamSha, personalSha, policyHash) =>
  digest([upstreamSha, personalSha, policyHash].join(":"));
export const evidenceComplete = (report, required, base, head) =>
  report?.baseSha === base &&
  report?.headSha === head &&
  required.every(
    (name) =>
      report.evidence?.[name]?.status === "passed" &&
      Array.isArray(report.evidence[name].urls) &&
      report.evidence[name].urls.length > 0 &&
      report.evidence[name].urls.every((url) => /^https:\/\//.test(url)),
  );

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ancestor = (a, b) => {
  try {
    git("merge-base", "--is-ancestor", a, b);
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
};
const marker = "<!-- t3-upstream:";
export const parseRequest = (body = "") => {
  const match = body.match(/<!-- t3-upstream:([A-Za-z0-9+/=]+) -->/);
  if (!match) return undefined;
  return JSON.parse(Buffer.from(match[1], "base64").toString());
};

async function main() {
  const policyText = readFileSync(".github/upstream/policy.json", "utf8");
  const policy = JSON.parse(policyText);
  if (process.env.GITHUB_REPOSITORY !== policy.repository)
    throw new Error("Repository does not match trusted policy");
  const policyHash = digest(policyText);
  const mode = process.env.SYNC_MODE || "scan";
  const executor = process.env.SYNC_EXECUTOR || "codex-cloud";
  if (!["codex-cloud", "work-cloud"].includes(executor)) throw new Error("Unknown cloud executor");
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("Missing GitHub token");
  const api = async (path, method = "GET", body, authenticated = true) => {
    const response = await fetch(`https://api.github.com/${path}`, {
      method,
      headers: {
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: ${response.status}`);
    return response.status === 204 ? undefined : response.json();
  };
  const list = async (path) => {
    const rows = [];
    for (let page = 1; ; page++) {
      const chunk = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      rows.push(...chunk);
      if (chunk.length < 100) return rows;
    }
  };
  const repo = `repos/${policy.repository}`;
  const identity = await api("user");
  if (identity.login !== process.env.SYNC_OWNER)
    throw new Error("Task token must belong to the linked Codex owner");
  const pulls = await list(
    `${repo}/pulls?state=all&base=${encodeURIComponent(policy.personalBranch)}`,
  );
  const managed = pulls.filter(
    (pr) =>
      pr.head.repo?.full_name === policy.repository &&
      pr.head.ref.startsWith(policy.candidatePrefix) &&
      pr.body?.includes(marker),
  );
  const personal = await api(`${repo}/git/ref/heads/${policy.personalBranch}`);
  const personalSha = personal.object.sha;
  git("fetch", "--no-tags", "origin", personalSha);
  const open = managed.filter((pr) => pr.state === "open");
  if (open.length > 1)
    throw new Error("Multiple active sync candidates; resolve before continuing");
  const active = open[0];
  if (active) {
    const request = parseRequest(active.body);
    if (request.personalSha !== personalSha || request.policyHash !== policyHash) {
      await api(`${repo}/issues/${active.number}/comments`, "POST", {
        body: "个人基线或保护策略已变化，旧验证失效。关闭旧候选；下一次检查从实际基线重新准备。",
      });
      await api(`${repo}/pulls/${active.number}`, "PATCH", { state: "closed" });
      return;
    }
    const comments = await list(`${repo}/issues/${active.number}/comments`);
    if (executor === "work-cloud") {
      if (
        !comments.some(
          (comment) =>
            comment.user.login === process.env.SYNC_OWNER &&
            comment.body.includes(`<!-- t3-work-cloud:${request.key} -->`),
        )
      ) {
        await api(`${repo}/issues/${active.number}/comments`, "POST", {
          body: task(request, policy, active.number, 1, executor),
        });
      }
      return;
    }
    const rounds = comments.filter(
      (comment) =>
        comment.body.startsWith("@codex ") && comment.user.login === process.env.SYNC_OWNER,
    );
    const last = rounds.at(-1);
    const timedOut =
      last && Date.now() - Date.parse(last.created_at) > policy.taskTimeoutMinutes * 60_000;
    // Public check results do not need additional permissions on the task token.
    const checks = await api(
      `${repo}/commits/${active.head.sha}/check-runs`,
      "GET",
      undefined,
      false,
    );
    const retryFailed =
      !request.canary &&
      active.head.sha !== request.seedSha &&
      mode === "scan" &&
      rounds.length < policy.maxRounds &&
      checks.check_runs.some(
        (check) =>
          check.name === "validate" &&
          check.conclusion === "failure" &&
          check.completed_at > last?.created_at,
      );
    if (mode === "retry" || retryFailed) {
      if (rounds.length >= policy.maxRounds)
        throw new Error("Automatic round limit reached; maintainer decision required");
      await api(`${repo}/issues/${active.number}/comments`, "POST", {
        body: task(request, policy, active.number, rounds.length + 1, executor),
      });
    } else if (timedOut && !comments.some((c) => c.body.includes(`<!-- timeout:${last.id} -->`))) {
      await api(`${repo}/issues/${active.number}/comments`, "POST", {
        body: `云端任务已超过等待窗口。保留草稿，请检查任务、额度和回写权限。<!-- timeout:${last.id} -->`,
      });
    }
    return;
  }
  if (mode === "retry") throw new Error("No active candidate");
  const releases = stableReleases(await list(`repos/${policy.upstream}/releases`));
  for (const release of mode === "canary" ? releases.slice(-1) : releases) {
    git(
      "fetch",
      "--no-tags",
      `https://github.com/${policy.upstream}.git`,
      `refs/tags/${release.tag_name}`,
    );
    const upstreamSha = git("rev-parse", "FETCH_HEAD^{commit}");
    const key = requestKey(upstreamSha, personalSha, policyHash);
    const previous = managed.filter((pr) => parseRequest(pr.body)?.upstreamSha === upstreamSha);
    const declined = previous.find(
      (pr) => !pr.merged_at && pr.state === "closed" && parseRequest(pr.body)?.key === key,
    );
    if (declined && mode !== "canary") continue;
    const rolledBack = previous.some((pr) =>
      pr.labels.some((label) => label.name === "upstream-rolled-back"),
    );
    if (ancestor(upstreamSha, personalSha) && !rolledBack && mode !== "canary") continue;
    const request = {
      key,
      upstreamSha,
      personalSha,
      policyHash,
      tag: release.tag_name,
      releaseUrl: release.html_url,
      canary: mode === "canary",
      rolledBack,
    };
    const branch = `${policy.candidatePrefix}${release.tag_name}-${key.slice(0, 10)}${request.canary ? `-canary-${process.env.GITHUB_RUN_ID}` : ""}`;
    const existing = managed.find((pr) => pr.head.ref === branch);
    if (existing) continue;
    // The durable version pin gives conflict-only updates a PR before Codex runs.
    const file = ".github/upstream/request.json";
    const parent = await api(`${repo}/git/commits/${personalSha}`);
    const tree = await api(`${repo}/git/trees`, "POST", {
      base_tree: parent.tree.sha,
      tree: [
        {
          path: file,
          mode: "100644",
          type: "blob",
          content: `${JSON.stringify(request, null, 2)}\n`,
        },
      ],
    });
    const commit = await api(`${repo}/git/commits`, "POST", {
      message: `chore(sync): prepare ${release.tag_name}`,
      tree: tree.sha,
      parents: [personalSha],
    });
    const ref = await api(`${repo}/git/matching-refs/heads/${branch}`);
    if (!ref.some((item) => item.ref === `refs/heads/${branch}`))
      await api(`${repo}/git/refs`, "POST", { ref: `refs/heads/${branch}`, sha: commit.sha });
    request.seedSha =
      ref.find((item) => item.ref === `refs/heads/${branch}`)?.object.sha || commit.sha;
    const common = git("merge-base", personalSha, upstreamSha);
    const localFiles = git("diff", "--name-only", common, personalSha);
    const officialFiles = git("diff", "--name-only", common, upstreamSha);
    const encoded = Buffer.from(JSON.stringify(request)).toString("base64");
    const body = `${marker}${encoded} -->\n官方版本：[${request.tag}](${request.releaseUrl})\n\n个人基线：\`${personalSha}\`\n官方提交：\`${upstreamSha}\`\n策略：\`${policyHash}\`\n\n${request.canary ? "接入金丝雀，不用于正式合并。" : "等待云端分析及独立验证，禁止自动合并。"}\n\n<details><summary>个人差异文件</summary>\n\n\`\`\`text\n${localFiles}\n\`\`\`\n</details>\n<details><summary>官方差异文件</summary>\n\n\`\`\`text\n${officialFiles}\n\`\`\`\n</details>\n\n关闭未合并候选表示暂缓本次版本；后续累计版本仍需重新评估拒绝原因。回滚后给本 PR 标记 upstream-rolled-back。`;
    const pr = await api(`${repo}/pulls`, "POST", {
      title: `${request.canary ? "[接入验证]" : "[上游同步]"} ${release.tag_name}`,
      head: branch,
      base: policy.personalBranch,
      draft: true,
      body,
    });
    await api(`${repo}/issues/${pr.number}/comments`, "POST", {
      body: task(request, policy, pr.number, 1, executor),
    });
    return;
  }
  writeFileSync(process.env.GITHUB_STEP_SUMMARY || "/dev/stdout", "没有需要创建的正式版本候选。\n");
}

export function task(request, policy, number, round, executor = "codex-cloud") {
  if (executor === "work-cloud") {
    return `<!-- t3-work-cloud:${request.key} -->\nPR #${number} 已交付官方 Work 云端自动执行器。固定个人基线 ${request.personalSha}、官方提交 ${request.upstreamSha}、策略 ${request.policyHash}。等待隔离适配与验证；正式合并仍由维护者决定。`;
  }
  if (executor !== "codex-cloud") throw new Error("Unknown cloud executor");
  return `@codex 请完成本仓库 PR #${number} 的上游同步任务（第 ${round}/${policy.maxRounds} 轮）。从个人基线 ${request.personalSha} 读取并遵守 .github/upstream/instructions.md 和 policy.json；官方固定提交 ${request.upstreamSha}，策略哈希 ${request.policyHash}。${request.rolledBack ? "该版本曾被回滚，必须依据实际代码树重新评估并恢复所需变化，不能仅检查祖先关系。" : ""}${request.canary ? "这是接入金丝雀：检查保护规则、运行控制器核心测试并在候选添加可验证的回写，不执行正式升级。" : "先阅读所有已关闭同步 PR 的拒绝理由和本 PR 上下文，分析后完整合并并适配个人功能。"}将修改推回本分支，报告证据及缺失项。不得修改门禁或合并 PR。`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
