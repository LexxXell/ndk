import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deriveSeed } from "../dist/index.js";
import {
  secp256k1Raw,
  secp256k1PublicKey,
  bip32Seed,
  ed25519Seed,
  hkdfSha256,
} from "../dist/profiles.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(join(here, "..", "vectors", "ndk-profiles-1.json"), "utf8"),
);
const master = Buffer.from(data.masterSecretHex, "hex");
const hex = (b) => Buffer.from(b).toString("hex");
const seedFor = (type) => deriveSeed(master, { ...data.baseDescriptor, type });
const vec = (type) => data.transforms.find((t) => t.type === type);

test("profile transforms reproduce ndk-profiles-1 vectors", () => {
  {
    const v = vec("secp256k1-raw");
    const seed = seedFor("secp256k1-raw");
    assert.equal(hex(seed), v.ndkSeedHex);
    assert.equal(hex(secp256k1Raw(seed)), v.output.privateKeyHex);
  }
  {
    const v = vec("bip32-seed");
    const master = bip32Seed(seedFor("bip32-seed"));
    assert.equal(hex(master.privateKey), v.output.masterPrivateKeyHex);
    assert.equal(hex(master.chainCode), v.output.chainCodeHex);
  }
  {
    const v = vec("ed25519-seed");
    const { privateSeed, publicKey } = ed25519Seed(seedFor("ed25519-seed"));
    assert.equal(hex(privateSeed), v.output.privateSeedHex);
    assert.equal(hex(publicKey), v.output.publicKeyHex);
  }
  {
    const v = vec("hkdf-sha256");
    assert.equal(hex(hkdfSha256(seedFor("hkdf-sha256"))), v.output.okmHex);
  }
});

test("secp256k1-raw rejects an out-of-range seed", () => {
  // n and above are invalid private keys.
  const n = Buffer.from(
    "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
    "hex",
  );
  assert.throws(() => secp256k1Raw(n));
  assert.throws(() => secp256k1Raw(Buffer.alloc(32))); // zero
});

test("secp256k1PublicKey is 33-byte compressed", () => {
  const pub = secp256k1PublicKey(seedFor("secp256k1-raw"));
  assert.equal(pub.length, 33);
  assert.ok(pub[0] === 0x02 || pub[0] === 0x03);
});

test("bip32Seed derives a child key", () => {
  const child = bip32Seed(seedFor("bip32-seed")).derive("m/44'/5'/0'/0/0");
  assert.ok(child.privateKey instanceof Uint8Array);
  assert.equal(child.privateKey.length, 32);
});

test("hkdfSha256 honours a custom length", () => {
  assert.equal(hkdfSha256(seedFor("hkdf-sha256"), { length: 64 }).length, 64);
});

test("transforms reject a non-32-byte seed", () => {
  assert.throws(() => secp256k1Raw(new Uint8Array(31)));
  assert.throws(() => ed25519Seed(new Uint8Array(16)));
  assert.throws(() => hkdfSha256(new Uint8Array(0)));
});
