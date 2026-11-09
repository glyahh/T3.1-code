import { it, assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as SqlClient from "effect/sql/SqlClient";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import { assertAntigravityResumeSafe } from "./AntigravityResumeSafety.ts";

it.effect("rejects cold resume with unfinished commands without rewriting SDK history", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "antigravity-resume-" });
      const file = path.join(dir, "history.db");
      yield* Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql.unsafe(
          "CREATE TABLE steps (idx INTEGER PRIMARY KEY,step_type INTEGER,status INTEGER,task_details BLOB)",
        );
        yield* sql.unsafe("INSERT INTO steps VALUES (162,21,2,NULL)");
      }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: file })));
      const failed = yield* assertAntigravityResumeSafe(file).pipe(Effect.flip);
      assert.equal(failed.method, "session/resume");
      yield* Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql.unsafe<{ status: number }>(
          "SELECT status FROM steps WHERE idx=162",
        );
        assert.equal(rows[0]?.status, 2);
        yield* sql.unsafe("UPDATE steps SET status=6");
      }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: file })));
      yield* assertAntigravityResumeSafe(file);
      yield* Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql.unsafe("UPDATE steps SET status=2, task_details=?", [new Uint8Array([48, 1])]);
      }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: file })));
      yield* assertAntigravityResumeSafe(file);
      yield* Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql.unsafe("UPDATE steps SET task_details=?", [new Uint8Array([48, 128])]);
      }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: file })));
      const malformed = yield* assertAntigravityResumeSafe(file).pipe(Effect.flip);
      assert.equal(malformed._tag, "AcpTransportError");
    }),
  ).pipe(Effect.provide(NodeServices.layer)),
);
