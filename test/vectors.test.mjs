import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHmac } from "node:crypto";
import {
  deriveSeedHex,
  compileLabels,
  descriptorFingerprint,
  rootNode,
  childNode,
  nodeKey,
} from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(join(here, "..", "vectors", "ndk-1.json"), "utf8"),
);

test("official SLIP-0021 vectors reproduce", () => {
  const S = Buffer.from(data.slip0021.masterSeedHex, "hex");
  const m = rootNode(S);
  assert.equal(Buffer.from(nodeKey(m)).toString("hex"), data.slip0021.keys["m"]);
  const a = childNode(m, "SLIP-0021");
  assert.equal(
    Buffer.from(nodeKey(a)).toString("hex"),
    data.slip0021.keys['m/"SLIP-0021"'],
  );
  const enc = childNode(a, "Master encryption key");
  assert.equal(
    Buffer.from(nodeKey(enc)).toString("hex"),
    data.slip0021.keys['m/"SLIP-0021"/"Master encryption key"'],
  );
  const auth = childNode(a, "Authentication key");
  assert.equal(
    Buffer.from(nodeKey(auth)).toString("hex"),
    data.slip0021.keys['m/"SLIP-0021"/"Authentication key"'],
  );
});

test("every NDK vector: seed, labels, intermediates, fingerprint", () => {
  for (const v of data.vectors) {
    const master = Buffer.from(v.masterSecretHex, "hex");
    assert.deepEqual(compileLabels(v.descriptor), v.labels, `${v.name}: labels`);
    assert.equal(deriveSeedHex(master, v.descriptor), v.seedHex, `${v.name}: seed`);
    assert.equal(
      descriptorFingerprint(v.descriptor),
      v.fingerprint,
      `${v.name}: fingerprint`,
    );
    // Re-derive intermediates independently and compare.
    let node = rootNode(master);
    v.intermediateNodeKeysHex.forEach((step, i) => {
      node = childNode(node, v.labels[i]);
      assert.equal(step.label, v.labels[i], `${v.name}: label ${i}`);
      assert.equal(
        Buffer.from(nodeKey(node)).toString("hex"),
        step.keyHex,
        `${v.name}: intermediate ${i}`,
      );
    });
  }
});

test("baseline vector matches the pinned value", () => {
  const v = data.vectors[0];
  assert.equal(
    v.seedHex,
    "1f39b1280a22d78b72f3b670768fdcd586d21d1a09315147b490845f231ff239",
  );
});

test("independent SLIP-0021 reimplementation agrees on the baseline", () => {
  // A second, dependency-free implementation to catch subtle core bugs.
  const h = (k, m) => createHmac("sha512", k).update(m).digest();
  const v = data.vectors[0];
  let node = h(Buffer.from("Symmetric key seed"), Buffer.from(v.masterSecretHex, "hex"));
  for (const label of v.labels) {
    node = h(node.subarray(0, 32), Buffer.concat([Buffer.from([0]), Buffer.from(label)]));
  }
  assert.equal(node.subarray(32, 64).toString("hex"), v.seedHex);
});

test("seed is a fresh 32-byte Uint8Array; master is not mutated", async () => {
  const { deriveSeed } = await import("../dist/index.js");
  const master = Buffer.from("00".repeat(32), "hex");
  const before = Buffer.from(master).toString("hex");
  const seed = deriveSeed(master, data.vectors[0].descriptor);
  assert.ok(seed instanceof Uint8Array);
  assert.equal(seed.length, 32);
  assert.equal(Buffer.from(master).toString("hex"), before, "master unchanged");
});
