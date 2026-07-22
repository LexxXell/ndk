/**
 * NDK Profiles — reference implementations of the seed→key transforms named by a
 * descriptor's `type` field.
 *
 * This module is OPTIONAL and lives behind the `@lexxxell/named-deterministic-keys/profiles`
 * subpath. Unlike the NDK core (which is dependency-free), the transforms require audited
 * third-party cryptography. Those libraries are declared as OPTIONAL peer dependencies:
 * install them only if you use this module.
 *
 *   npm install @noble/curves @noble/hashes @scure/bip32
 *
 * Each transform takes the 32-byte NDK seed and is byte-for-byte conformant with the NDK
 * Profiles specification: https://github.com/Patternity/ndk/blob/master/SPEC-PROFILES.md
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { HDKey } from "@scure/bip32";

/** The secp256k1 group order n. */
const SECP256K1_N =
  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

function toBigIntBE(bytes: Uint8Array): bigint {
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
}

function requireSeed32(seed: Uint8Array): void {
  if (seed.length !== 32) {
    throw new Error(`expected a 32-byte NDK seed, got ${seed.length}`);
  }
}

/**
 * `secp256k1-raw`: interpret the seed as a big-endian scalar `d` and use it as a
 * secp256k1 private key. Throws if `d == 0` or `d >= n` (bump the profile generation and
 * re-derive). Returns the 32-byte private key (the seed bytes, once validated).
 */
export function secp256k1Raw(seed: Uint8Array): Uint8Array {
  requireSeed32(seed);
  const d = toBigIntBE(seed);
  if (d === 0n || d >= SECP256K1_N) {
    throw new Error("secp256k1-raw: seed is not a valid private key; bump generation");
  }
  return Uint8Array.prototype.slice.call(seed, 0, 32);
}

/** Compressed secp256k1 public key for a `secp256k1-raw` private key. */
export function secp256k1PublicKey(seed: Uint8Array): Uint8Array {
  return secp256k1.getPublicKey(secp256k1Raw(seed), true);
}

/**
 * `bip32-seed`: use the seed as a BIP-32 seed and return the master node
 * (`HMAC-SHA512("Bitcoin seed", seed)`). Derive child keys from the returned HDKey, e.g.
 * `bip32Seed(seed).derive("m/44'/5'/0'/0/0")`. Throws if the master key is invalid.
 */
export function bip32Seed(seed: Uint8Array): HDKey {
  requireSeed32(seed);
  return HDKey.fromMasterSeed(seed);
}

/**
 * `ed25519-seed`: the seed IS the Ed25519 private-key seed (RFC 8032). Returns the seed
 * and its public key.
 */
export function ed25519Seed(seed: Uint8Array): {
  readonly privateSeed: Uint8Array;
  readonly publicKey: Uint8Array;
} {
  requireSeed32(seed);
  return {
    privateSeed: Uint8Array.prototype.slice.call(seed, 0, 32),
    publicKey: ed25519.getPublicKey(seed),
  };
}

/**
 * `hkdf-sha256`: derive `length` symmetric key bytes with HKDF-SHA256 (RFC 5869),
 * IKM = seed, `salt` = empty, `info` = empty by default. Default length is 32.
 */
export function hkdfSha256(
  seed: Uint8Array,
  options: { readonly length?: number; readonly info?: Uint8Array } = {},
): Uint8Array {
  requireSeed32(seed);
  const length = options.length ?? 32;
  const info = options.info ?? new Uint8Array(0);
  return hkdf(sha256, seed, new Uint8Array(0), info, length);
}

export { HDKey };
