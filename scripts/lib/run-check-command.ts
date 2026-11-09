// @effect-diagnostics nodeBuiltinImport:off - this subprocess bootstrap runs without an Effect runtime.
import * as NodeFS from "node:fs";
import * as NodeChildProcess from "node:child_process";
import * as NodeURL from "node:url";

export const checkCommandLauncherPath = NodeURL.fileURLToPath(import.meta.url);

if (import.meta.main) {
  const invocation: unknown = JSON.parse(NodeFS.readFileSync(process.argv[2]!, "utf8"));
  if (
    typeof invocation !== "object" ||
    invocation === null ||
    !("command" in invocation) ||
    typeof invocation.command !== "string" ||
    !("args" in invocation) ||
    !Array.isArray(invocation.args) ||
    !invocation.args.every((arg) => typeof arg === "string")
  )
    throw new Error("Invalid check invocation.");
  const shell =
    "shell" in invocation &&
    (typeof invocation.shell === "boolean" || typeof invocation.shell === "string")
      ? invocation.shell
      : false;
  const child = NodeChildProcess.spawn(invocation.command, invocation.args, {
    shell,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", (error) => {
    process.stderr.write(`Check process failed: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
