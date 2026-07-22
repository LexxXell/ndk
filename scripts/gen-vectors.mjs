// Generate the normative NDK-1 test vectors from the reference implementation.
// The implementation is the source of truth; SPEC vectors are regenerated from here.
// Run: npm run vectors  (builds first, then writes vectors/ndk-1.json)

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  compileLabels,
  deriveSeedHex,
  descriptorFingerprint,
} from "../dist/index.js";
import { rootNode, childNode, nodeKey } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));

const MASTER_HEX =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

function intermediates(masterHex, descriptor) {
  const master = Buffer.from(masterHex, "hex");
  const labels = compileLabels(descriptor);
  let node = rootNode(master);
  const steps = [];
  for (const label of labels) {
    node = childNode(node, label);
    steps.push({ label, keyHex: Buffer.from(nodeKey(node)).toString("hex") });
  }
  return steps;
}

function vector(name, descriptor, masterHex = MASTER_HEX) {
  const steps = intermediates(masterHex, descriptor);
  return {
    name,
    masterSecretHex: masterHex,
    descriptor,
    labels: compileLabels(descriptor),
    intermediateNodeKeysHex: steps,
    fingerprint: descriptorFingerprint(descriptor),
    seedHex: deriveSeedHex(Buffer.from(masterHex, "hex"), descriptor),
  };
}

const base = {
  ndk: 1,
  subject: "github:Patternity/ndk",
  purpose: "donations",
  profile: "dash:mainnet",
  type: "bip32-seed",
};

const vectors = [
  vector("dash donations (bip32-seed)", base),
  vector("dash donations (secp256k1-raw)", { ...base, type: "secp256k1-raw" }),
  vector("dash testnet", { ...base, profile: "dash:testnet" }),
  vector("dash donations generation 2", { ...base, profile: "dash:mainnet:2" }),
  vector("release signing (ed25519)", {
    ndk: 1,
    subject: "github:Patternity/ndk",
    purpose: "release-signing",
    profile: "minisign",
    type: "ed25519-seed",
  }),
  vector("ssh authentication", {
    ndk: 1,
    subject: "user:alice@example.org",
    purpose: "authentication",
    profile: "ssh:ed25519",
    type: "ed25519-seed",
  }),
  vector("vault symmetric key (hkdf)", {
    ndk: 1,
    subject: "domain:example.org",
    purpose: "encryption",
    profile: "application:vault:v1",
    type: "hkdf-sha256",
  }),
];

const out = {
  spec: "ndk-1",
  slip0021: {
    note: "NDK uses SLIP-0021 unmodified; these official vectors must also pass.",
    masterSeedHex:
      "c76c4ac4f4e4a00d6b274d5c39c700bb4a7ddc04fbc6f78e85ca75007b5b495f74a9043eeb77bdd53aa6fc3a0e31462270316fa04b8c19114c8798706cd02ac8",
    keys: {
      "m": "dbf12b44133eaab506a740f6565cc117228cbf1dd70635cfa8ddfdc9af734756",
      'm/"SLIP-0021"':
        "1d065e3ac1bbe5c7fad32cf2305f7d709dc070d672044a19e610c77cdf33de0d",
      'm/"SLIP-0021"/"Master encryption key"':
        "ea163130e35bbafdf5ddee97a17b39cef2be4b4f390180d65b54cf05c6a82fde",
      'm/"SLIP-0021"/"Authentication key"':
        "47194e938ab24cc82bfa25f6486ed54bebe79c40ae2a5a32ea6db294d81861a6",
    },
  },
  vectors,
};

const target = join(here, "..", "vectors", "ndk-1.json");
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${vectors.length} vectors to ${target}`);
