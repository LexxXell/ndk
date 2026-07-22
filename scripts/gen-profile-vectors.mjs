// Generate NDK Profiles transform vectors from the reference implementation.
// Uses the optional profiles module (audited crypto deps). Run: npm run vectors

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deriveSeed } from "../dist/index.js";
import {
  secp256k1Raw,
  bip32Seed,
  ed25519Seed,
  hkdfSha256,
} from "../dist/profiles.js";

const here = dirname(fileURLToPath(import.meta.url));
const hex = (b) => Buffer.from(b).toString("hex");

const MASTER_HEX =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const master = Buffer.from(MASTER_HEX, "hex");
const base = {
  ndk: 1,
  subject: "github:Patternity/ndk",
  purpose: "donations",
  profile: "dash:mainnet",
};

const seedFor = (type) => deriveSeed(master, { ...base, type });

const sSecp = seedFor("secp256k1-raw");
const sBip = seedFor("bip32-seed");
const bip = bip32Seed(sBip);
const sEd = seedFor("ed25519-seed");
const ed = ed25519Seed(sEd);
const sH = seedFor("hkdf-sha256");

const out = {
  spec: "ndk-profiles-1",
  note: "Transform outputs for the NDK core baseline descriptor with type varied. See SPEC-PROFILES.md.",
  masterSecretHex: MASTER_HEX,
  baseDescriptor: base,
  transforms: [
    { type: "secp256k1-raw", ndkSeedHex: hex(sSecp), output: { privateKeyHex: hex(secp256k1Raw(sSecp)) } },
    {
      type: "bip32-seed",
      ndkSeedHex: hex(sBip),
      output: { masterPrivateKeyHex: hex(bip.privateKey), chainCodeHex: hex(bip.chainCode) },
    },
    {
      type: "ed25519-seed",
      ndkSeedHex: hex(sEd),
      output: { privateSeedHex: hex(ed.privateSeed), publicKeyHex: hex(ed.publicKey) },
    },
    {
      type: "hkdf-sha256",
      ndkSeedHex: hex(sH),
      output: { params: { salt: "", info: "", L: 32 }, okmHex: hex(hkdfSha256(sH)) },
    },
  ],
};

const target = join(here, "..", "vectors", "ndk-profiles-1.json");
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.transforms.length} profile transforms to ${target}`);
