import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDescriptor } from "../dist/index.js";

const validText = JSON.stringify({
  ndk: 1,
  subject: "github:Patternity/ndk",
  purpose: "donations",
  profile: "dash:mainnet",
  type: "bip32-seed",
});

test("parses a valid descriptor from text", () => {
  const r = parseDescriptor(validText);
  assert.equal(r.valid, true);
  assert.equal(r.descriptor.subject, "github:Patternity/ndk");
});

test("property order in text does not matter", () => {
  const reordered =
    '{"type":"bip32-seed","profile":"dash:mainnet","purpose":"donations","subject":"github:Patternity/ndk","ndk":1}';
  assert.equal(parseDescriptor(reordered).valid, true);
});

test("rejects duplicate property name (duplicate-property)", () => {
  const dup =
    '{"ndk":1,"purpose":"a","purpose":"b","subject":"github:x/y","profile":"dash:mainnet","type":"bip32-seed"}';
  const r = parseDescriptor(dup);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === "duplicate-property"));
  assert.equal(r.errors[0].path, "/purpose");
});

test("rejects duplicate key inside a nested object too", () => {
  const dup = '{"a":{"x":1,"x":2}}';
  const r = parseDescriptor(dup);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === "duplicate-property"));
});

test("rejects malformed JSON (invalid-json)", () => {
  for (const bad of ['{ "ndk": 1, ', "{", "not json", '{"a":}', '{"a":1,}']) {
    const r = parseDescriptor(bad);
    assert.equal(r.valid, false, `should reject: ${bad}`);
    assert.ok(r.errors.some((e) => e.code === "invalid-json"), `invalid-json for: ${bad}`);
  }
});

test("rejects ndk as a float literal 1.0 (invalid-value)", () => {
  const r = parseDescriptor(
    '{"ndk":1.0,"subject":"github:x/y","purpose":"a","profile":"dash:mainnet","type":"bip32-seed"}',
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === "invalid-value" && e.path === "/ndk"));
});

test("accepts ndk as integer literal 1", () => {
  const r = parseDescriptor(
    '{"ndk":1,"subject":"github:x/y","purpose":"a","profile":"dash:mainnet","type":"bip32-seed"}',
  );
  assert.equal(r.valid, true);
});

test("rejects trailing content after the JSON value", () => {
  const r = parseDescriptor(validText + " extra");
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === "invalid-json"));
});

test("still applies semantic validation after a clean parse", () => {
  const r = parseDescriptor(
    '{"ndk":1,"subject":"github:x/y","purpose":"BAD","profile":"dash:mainnet","type":"bip32-seed"}',
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === "invalid-format"));
});

test("handles unicode escapes in strings", () => {
  // "user:é@example.org" is precomposed NFC, should be accepted.
  const r = parseDescriptor(
    '{"ndk":1,"subject":"user:\\u00e9@example.org","purpose":"a","profile":"dash:mainnet","type":"bip32-seed"}',
  );
  assert.equal(r.valid, true);
});
