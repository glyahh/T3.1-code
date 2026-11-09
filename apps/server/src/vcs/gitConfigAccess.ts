// @effect-diagnostics nodeBuiltinImport:off - lock identity must be found without starting Git, which itself reads config.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";

// Readers share permits; a writer reserves all without limiting parallel checkouts.
const readerPermits = Number.MAX_SAFE_INTEGER;
const gates = new Map<string, { admission: Semaphore.Semaphore; access: Semaphore.Semaphore }>();

const optionalStat = async (file: string) => {
  try {
    return await NodeFSP.stat(file);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    )
      return undefined;
    throw error;
  }
};

async function commonDirectory(input: {
  cwd: string;
  args: ReadonlyArray<string>;
  env?: NodeJS.ProcessEnv | undefined;
}) {
  const env = { ...process.env, ...input.env };
  let cwd = input.cwd;
  let gitDirectory = env.GIT_DIR;
  for (let index = 0; index < input.args.length; index++) {
    const arg = input.args[index]!;
    if (arg === "--git-dir") gitDirectory = input.args[++index];
    else if (arg.startsWith("--git-dir=")) gitDirectory = arg.slice("--git-dir=".length);
    else if (arg === "-C") cwd = NodePath.resolve(cwd, input.args[++index] ?? "");
    else if (["-c", "--work-tree", "--namespace", "--config-env"].includes(arg)) index++;
    else if (arg === "--" || !arg.startsWith("-")) break;
  }
  if (!(await optionalStat(cwd))) return undefined;
  if (gitDirectory !== undefined) gitDirectory = NodePath.resolve(cwd, gitDirectory);
  else {
    let directory = await NodeFSP.realpath(cwd);
    while (true) {
      const gitPath = NodePath.join(directory, ".git");
      const entry = await optionalStat(gitPath);
      if (entry?.isDirectory()) {
        gitDirectory = gitPath;
        break;
      }
      if (entry?.isFile()) {
        const contents = (await NodeFSP.readFile(gitPath, "utf8")).replace(/\r?\n$/, "");
        if (!contents.startsWith("gitdir: ")) throw new Error("Invalid Git directory reference.");
        gitDirectory = NodePath.resolve(directory, contents.slice("gitdir: ".length));
        break;
      }
      if (
        (await optionalStat(NodePath.join(directory, "HEAD")))?.isFile() &&
        (await optionalStat(NodePath.join(directory, "objects")))?.isDirectory()
      ) {
        gitDirectory = directory;
        break;
      }
      const parent = NodePath.dirname(directory);
      if (parent === directory) return undefined;
      directory = parent;
    }
  }
  if (env.GIT_COMMON_DIR !== undefined) gitDirectory = NodePath.resolve(cwd, env.GIT_COMMON_DIR);
  else {
    const reference = NodePath.join(gitDirectory, "commondir");
    if (await optionalStat(reference)) {
      const common = (await NodeFSP.readFile(reference, "utf8")).replace(/\r?\n$/, "");
      if (!common) throw new Error("Invalid Git common directory reference.");
      gitDirectory = NodePath.resolve(gitDirectory, common);
    }
  }
  return (await NodeFSP.realpath(gitDirectory)).toLowerCase();
}

/** Windows config replacement can reject readers; both VCS runners share this gate. */
export const withGitConfigAccess = Effect.fn("GitConfigAccess.withAccess")(function* <A, E, R>(
  input: Parameters<typeof commonDirectory>[0] & { writesSharedConfig?: boolean | undefined },
  effect: (onProcessExit: Effect.Effect<void>) => Effect.Effect<A, E, R>,
  mapError: (cause: unknown) => E,
): Effect.fn.Return<A, E, R> {
  const common = yield* Effect.tryPromise({ try: () => commonDirectory(input), catch: mapError });
  if (common === undefined) return yield* effect(Effect.void);
  let gate = gates.get(common);
  if (gate === undefined) {
    gate = { admission: Semaphore.makeUnsafe(1), access: Semaphore.makeUnsafe(readerPermits) };
    gates.set(common, gate);
  }
  const permits = input.writesSharedConfig ? readerPermits : 1;
  const access = gate.access;
  let released = false;
  const release = Effect.gen(function* () {
    if (released) return;
    released = true;
    yield* access.release(permits);
  }).pipe(Effect.uninterruptible);
  return yield* Effect.acquireUseRelease(
    Effect.interruptible(gate.admission.withPermit(access.take(permits))),
    () => effect(release),
    () => release,
  );
});
