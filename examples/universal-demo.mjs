// Universal-output demonstration: ONE Dash-identity key (master secret) plus per-target
// NDK descriptors deriving real keys/addresses for many independent networks.
//
// This is an EXAMPLE. It depends on audited third-party libraries (@noble/*, @scure/*)
// that are NOT dependencies of the NDK core package — the core stays blockchain-agnostic
// and dependency-free. Run with:  npm run build && node examples/universal-demo.mjs
//
// The master secret here stands in for a Dash Platform identity's key[0]; the descriptors
// stand in for public documents stored on Platform. Same root -> any downstream key.

import { deriveSeed } from "../dist/index.js";
// The generic seed->key transforms come from the optional profiles module.
import { secp256k1Raw, bip32Seed, ed25519Seed, hkdfSha256 } from "../dist/profiles.js";
// Network-specific encoding (addresses, wire formats) stays in the example.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { base58, base58check, base64 } from "@scure/base";

const hex = (b) => Buffer.from(b).toString("hex");
const b58c = base58check(sha256);

// Master secret = a Dash Platform identity key (index 0). For a reproducible example we
// use the m/44'/5'/0' key from the BIP-39 Trezor test mnemonic.
const master = Buffer.from(
  "446ea5ce843b2f22534cc3ac139ab080c1fad35872b7b475c5dfc544c3068b28",
  "hex",
);
const subject = "dash:identity:demo";
const d = (purpose, profile, type) => ({ ndk: 1, subject, purpose, profile, type });

// --- network-specific encoding on top of the NDK Profiles transforms ---
const p2pkh = (pubCompressed, version) =>
  b58c.encode(Uint8Array.from([version, ...ripemd160(sha256(pubCompressed))]));
const ethAddress = (priv) =>
  "0x" + hex(keccak_256(secp256k1.getPublicKey(priv, false).slice(1)).slice(12));
const sshEd25519 = (pub) => {
  const str = (b) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(b.length);
    return Buffer.concat([len, Buffer.from(b)]);
  };
  const wire = Buffer.concat([str(Buffer.from("ssh-ed25519")), str(Buffer.from(pub))]);
  return "ssh-ed25519 " + base64.encode(wire);
};

console.log("MASTER  = one Dash identity key[0]:", hex(master));
console.log("subject =", subject, "\n");

// 1. Dash (L1, HD) — bip32-seed / m/44'/5'/0'/0/0
{
  const seed = deriveSeed(master, d("donations", "dash:mainnet", "bip32-seed"));
  const key = bip32Seed(seed).derive("m/44'/5'/0'/0/0");
  console.log("Dash     address:", p2pkh(key.publicKey, 0x4c));
}
// 2. Bitcoin (L1, HD) — bip32-seed / m/44'/0'/0'/0/0
{
  const seed = deriveSeed(master, d("donations", "bitcoin:mainnet", "bip32-seed"));
  const key = bip32Seed(seed).derive("m/44'/0'/0'/0/0");
  console.log("Bitcoin  address:", p2pkh(key.publicKey, 0x00));
}
// 3. Ethereum — secp256k1-raw (the seed IS the private key)
{
  const seed = deriveSeed(master, d("treasury", "ethereum:mainnet", "secp256k1-raw"));
  console.log("Ethereum address:", ethAddress(secp256k1Raw(seed)));
}
// 4. Solana — ed25519-seed -> base58 public key
{
  const seed = deriveSeed(master, d("treasury", "solana:mainnet", "ed25519-seed"));
  console.log("Solana   address:", base58.encode(ed25519Seed(seed).publicKey));
}
// 5. SSH — ed25519-seed -> OpenSSH public key
{
  const seed = deriveSeed(master, d("authentication", "ssh:ed25519", "ed25519-seed"));
  console.log("SSH   public key:", sshEd25519(ed25519Seed(seed).publicKey));
}
// 6. Symmetric secret — hkdf-sha256
{
  const seed = deriveSeed(master, d("encryption", "application:vault:v1", "hkdf-sha256"));
  console.log("Vault key (32B) :", hex(hkdfSha256(seed)));
}
