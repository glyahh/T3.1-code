import * as Effect from "effect/Effect";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as SqlClient from "effect/sql/SqlClient";
import * as AcpErrors from "effect-acp/errors";

function isDaemon(bytes: Uint8Array | null): boolean {
  if (!bytes) return false;
  let offset = 0;
  const read = () => {
    let value = 0;
    let scale = 1;
    while (offset < bytes.length && scale <= 2 ** 49) {
      const byte = bytes[offset++]!;
      value += (byte & 127) * scale;
      if (byte < 128) return value;
      scale *= 128;
    }
    throw new Error("Invalid Antigravity task metadata");
  };
  while (offset < bytes.length) {
    const tag = read();
    const field = Math.floor(tag / 8);
    switch (tag % 8) {
      case 0: {
        const value = read();
        if (field === 6) return value !== 0;
        break;
      }
      case 1:
        offset += 8;
        break;
      case 2: {
        const length = read();
        offset += length;
        break;
      }
      case 5:
        offset += 4;
        break;
      default:
        throw new Error("Unsupported Antigravity task metadata");
    }
    if (offset > bytes.length) throw new Error("Truncated Antigravity task metadata");
  }
  return false;
}

// A new harness cannot own the command processes recorded by a terminated harness.
export const assertAntigravityResumeSafe = Effect.fn("AntigravityResumeSafety.check")(
  function* (filename: string) {
    const rows = yield* Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      return yield* sql.unsafe<{ idx: number; task_details: Uint8Array | null }>(
        "SELECT idx, task_details FROM steps WHERE step_type=21 AND status IN (1,2,9,11)",
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename, readonly: true })));
    const unsafe = yield* Effect.try({
      try: () => rows.some((row) => !isDaemon(row.task_details)),
      catch: (cause) =>
        new AcpErrors.AcpTransportError({
          method: "session/resume",
          detail: "Invalid Antigravity task metadata",
          cause,
        }),
    });
    if (unsafe)
      yield* Effect.logWarning("Rejecting unsafe Antigravity cold resume", {
        reason: "unfinished_native_commands",
        count: rows.length,
      });
    if (unsafe)
      return yield* new AcpErrors.AcpTransportError({
        method: "session/resume",
        detail: "Unfinished commands belong to an earlier Antigravity runtime",
        cause: undefined,
      });
  },
  Effect.mapError(
    (cause) =>
      new AcpErrors.AcpTransportError({
        method: "session/resume",
        operation: "call-rpc",
        detail:
          "Antigravity native history cannot safely resume; recover context in a fresh session.",
        cause,
      }),
  ),
);
