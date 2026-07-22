import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "dist", "cli.js");
const dir = mkdtempSync(join(tmpdir(), "ndk-cli-"));
const desc = join(dir, "desc.json");
const seed = join(dir, "master.hex");
writeFileSync(
  desc,
  JSON.stringify({
    ndk: 1,
    subject: "github:Patternity/ndk",
    purpose: "donations",
    profile: "dash:mainnet",
    type: "bip32-seed",
  }),
);
writeFileSync(seed, "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f\n");

const run = (args, opts = {}) =>
  execFileSync("node", [CLI, ...args], { encoding: "utf8", ...opts }).trim();

const runFail = (args, opts = {}) => {
  try {
    execFileSync("node", [CLI, ...args], { encoding: "utf8", stdio: "pipe", ...opts });
    return null; // did not fail
  } catch (e) {
    return e.status;
  }
};

test("validate exits 0 for a valid descriptor", () => {
  assert.equal(run(["validate", desc]), '{"valid":true}');
});

test("labels prints the compiled labels", () => {
  assert.deepEqual(JSON.parse(run(["labels", desc])), [
    "ndk:1",
    "subject:github:Patternity/ndk",
    "purpose:donations",
    "profile:dash:mainnet",
    "type:bip32-seed",
  ]);
});

test("fingerprint prints a 16-hex-char value", () => {
  assert.match(run(["fingerprint", desc]), /^[0-9a-f]{16}$/);
});

test("derive with --seed-file yields the baseline seed", () => {
  assert.equal(
    run(["derive", desc, "--seed-file", seed]),
    "1f39b1280a22d78b72f3b670768fdcd586d21d1a09315147b490845f231ff239",
  );
});

test("derive with --seed-stdin yields the baseline seed", () => {
  const out = execFileSync("node", [CLI, "derive", desc, "--seed-stdin"], {
    encoding: "utf8",
    input: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  }).trim();
  assert.equal(out, "1f39b1280a22d78b72f3b670768fdcd586d21d1a09315147b490845f231ff239");
});

test("derive without a seed source fails non-zero", () => {
  assert.equal(runFail(["derive", desc]), 1);
});

test("validate fails non-zero for an invalid descriptor", () => {
  const bad = join(dir, "bad.json");
  writeFileSync(bad, '{"ndk":2}');
  assert.equal(runFail(["validate", bad]), 1);
});

test("duplicate keys in the descriptor file are rejected", () => {
  const dup = join(dir, "dup.json");
  writeFileSync(
    dup,
    '{"ndk":1,"purpose":"a","purpose":"b","subject":"github:x/y","profile":"dash:mainnet","type":"bip32-seed"}',
  );
  assert.equal(runFail(["validate", dup]), 1);
});
