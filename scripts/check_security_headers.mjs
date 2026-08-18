import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
const contentSecurityPolicy = headers
  .split(/\r?\n/)
  .find((line) => line.trimStart().startsWith("Content-Security-Policy:"));

assert.ok(contentSecurityPolicy, "Content-Security-Policy header is required");
assert.match(
  contentSecurityPolicy,
  /script-src\s+'self'\s+'wasm-unsafe-eval'/,
  "sql.js needs the narrowly scoped wasm-unsafe-eval permission",
);
assert.doesNotMatch(
  contentSecurityPolicy,
  /(?:^|\s)'unsafe-eval'(?:\s|;|$)/,
  "general JavaScript unsafe-eval must remain disabled",
);

console.log("Security headers allow WebAssembly without enabling JavaScript eval.");
