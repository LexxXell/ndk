# @lexxxell/named-deterministic-keys

TypeScript reference implementation of **NDK-1 — Named Deterministic Keys**: deterministic
derivation of a 32-byte seed from a master secret and a small, human-readable JSON
descriptor, using [SLIP-0021](https://github.com/satoshilabs/slips/blob/master/slip-0021.md)
without modification.

> This is a reference implementation of the NDK specification maintained by **Patternity**
> at <https://github.com/Patternity/ndk>. The specification — not this package — defines
> normative behavior. Where the two disagree, the specification wins.

```ts
import { deriveSeedHex } from "@lexxxell/named-deterministic-keys";

const master = Buffer.from(
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "hex",
);
const seed = deriveSeedHex(master, {
  ndk: 1,
  subject: "github:Patternity/ndk",
  purpose: "donations",
  profile: "dash:mainnet",
  type: "bip32-seed",
});
// => 1f39b1280a22d78b72f3b670768fdcd586d21d1a09315147b490845f231ff239
```

## What NDK does

Given a **master secret** (raw bytes) and a **descriptor** (five fields), NDK compiles the
descriptor into five ordered SLIP-0021 labels and returns the final 32-byte SLIP-0021 node
key. The same master secret and descriptor always produce the same 32 bytes, in any
conforming implementation and any language.

## What NDK does not do

NDK is **not** a new cryptographic primitive, a wallet standard, a mnemonic scheme, a KDF,
or a source of entropy. It does not generate the master secret, define BIP-32 paths, build
addresses, or make guessable values safe. The 32-byte output is **opaque seed material —
not itself a private key**.

## Key ideas

- **Why 32 bytes?** The output is the final SLIP-0021 node key, `node[32:64]` — exactly 32
  bytes, the size downstream constructions (Ed25519 seed, secp256k1 scalar, BIP-32 seed,
  symmetric key) expect. The chain half `node[0:32]` is never returned, so it cannot leak.
- **Why are descriptors public?** Security rests entirely on the master secret. The
  descriptor is meant to be stored publicly (e.g. alongside a project) for recovery.
- **Why must the master secret stay secret?** It is the only secret. Anyone with it can
  derive every seed for any known or guessed descriptor.
- **Why preserve the exact descriptor?** Derivation is byte-exact. Changing any character —
  case, a trailing slash, Unicode form — produces a different seed. Store the exact bytes.
- **Why doesn't `profile` implement a blockchain?** `profile` is an opaque downstream tag
  (e.g. `dash:mainnet`). It selects context, not code. The seed→key transform is named by
  `type` and defined by the separate [NDK Profiles](https://github.com/Patternity/ndk/blob/master/SPEC-PROFILES.md)
  spec; turning the seed into a real key is the consumer's job.
- **How JSON becomes labels.** Fields are read by name (order-independent) and compiled in
  the fixed order `ndk, subject, purpose, profile, type`, each as `key:value`, then fed to
  SLIP-0021.

## Install

```sh
npm install @lexxxell/named-deterministic-keys
```

ESM, isomorphic (Node.js ≥ 20.19 and browsers). One small audited runtime dependency:
[`@noble/hashes`](https://github.com/paulmillr/noble-hashes) (HMAC-SHA512 / SHA-256). The
core uses no `node:crypto` and no `Buffer`, so it runs unchanged in the browser.

## Library API

```ts
import {
  validateDescriptor, // (value: unknown) => ValidationResult
  parseDescriptor,    // (jsonText: string) => ValidationResult  (strict: duplicate keys)
  compileLabels,      // (descriptor) => readonly string[]
  deriveSeed,         // (master: Uint8Array, descriptor) => Uint8Array (32 bytes, fresh)
  deriveSeedHex,      // (master: Uint8Array, descriptor) => string
  descriptorFingerprint, // (descriptor) => string  (non-secret, 16 hex chars)
} from "@lexxxell/named-deterministic-keys";
```

- **Validate an object** with `validateDescriptor`; **validate untrusted JSON text** with
  `parseDescriptor` (it additionally rejects duplicate property names and a float `ndk`
  such as `1.0`, which `JSON.parse` cannot detect).
- `deriveSeed` returns a fresh `Uint8Array` and never mutates the master-secret buffer.
- `descriptorFingerprint` is a non-secret SHA-256 over the labels (first 8 bytes); it does
  not involve the master secret and is safe to log for drift detection.

Validation returns structured errors with stable codes:

```ts
const r = validateDescriptor({ ndk: 1, subject: "x", purpose: "P", /* ... */ });
// { valid: false, errors: [{ path: "/purpose", code: "invalid-format", message: "..." }, ...] }
```

## CLI (for testing and demonstration)

```sh
ndk validate <descriptor.json>
ndk labels <descriptor.json>
ndk fingerprint <descriptor.json>
ndk derive <descriptor.json> (--seed-file <hex-file> | --seed-stdin)
```

**Safe by construction:** the master secret is read only from a protected file or stdin as
hex — **never** from a command-line argument (which would leak into shell history and
process listings). Diagnostics go to stderr; machine output to stdout; exit code is
non-zero on failure. Only `derive` prints a secret (the seed you explicitly asked for).

```sh
# read the secret from a protected file, never from argv
ndk derive descriptor.json --seed-file ~/.secrets/ndk.hex

# or from stdin
cat ~/.secrets/ndk.hex | ndk derive descriptor.json --seed-stdin
```

## Obtaining a master secret

The origin of the master secret is out of scope for NDK (bring your own bytes). See
[SPEC.md Appendix A](https://github.com/Patternity/ndk/blob/master/SPEC.md) for informative
patterns — including deriving it from a BIP-39 mnemonic (your NDK keys are automatically
domain-separated from any BIP-32 wallet from the same mnemonic). Prefer a **dedicated**
secret for high-value contexts.

## Transforms: seed → key (optional `/profiles`)

The core stops at a 32-byte seed. To turn it into an actual key, import the **optional**
profiles module, which implements the [NDK Profiles](https://github.com/Patternity/ndk/blob/master/SPEC-PROFILES.md)
transforms and is byte-for-byte conformant with their vectors:

```ts
import { secp256k1Raw, bip32Seed, ed25519Seed, hkdfSha256 } from "@lexxxell/named-deterministic-keys/profiles";

const seed = deriveSeed(master, descriptor);           // 32 bytes (core, dep-free)
const priv = secp256k1Raw(seed);                       // secp256k1 private key (Ethereum, ...)
const node = bip32Seed(seed).derive("m/44'/5'/0'/0/0"); // BIP-32 HD key (Dash, Bitcoin, ...)
const { publicKey } = ed25519Seed(seed);               // Ed25519 (Solana, SSH, Minisign)
const key32 = hkdfSha256(seed);                        // symmetric key (HKDF-SHA256)
```

This module needs two more audited peer dependencies (`@noble/curves`, `@scure/bip32`) —
declared **optional**, so the base install stays minimal (`@noble/hashes` is already the
core's dependency). Install them only if you use `/profiles`:

```sh
npm install @noble/curves @noble/hashes @scure/bip32
```

## Examples: one root → any key

The 32-byte NDK seed is universal: via the `type` transform it becomes a key for any
blockchain, SSH, a signing tool, or a symmetric secret. [`examples/universal-demo.mjs`](examples/universal-demo.mjs)
derives real addresses for **Dash, Bitcoin, Ethereum, Solana, an SSH key, and a symmetric
vault key from a single master secret**:

```sh
npm run build && node examples/universal-demo.mjs
```

The intended architecture uses a **Dash Platform identity** as the master-secret source and
its **documents** as the public descriptor registry — one identity, every key you own,
everywhere. See [`examples/README.md`](examples/README.md). The extra example libraries
(`@noble/curves`, `@scure/*`) are `devDependencies`; the core ships only `@noble/hashes`.

## Development

```sh
npm install
npm run build      # tsc -> dist/
npm test           # build + node --test
npm run vectors    # regenerate vectors/ndk-1.json from this implementation
```

Tests cover the official SLIP-0021 vectors, all NDK vectors and intermediate node keys, an
independent `node:crypto` second implementation of the core, domain separation per field, descriptor
validation, strict JSON parsing, and the CLI.

## License

[MIT](LICENSE). The upstream specification and its test vectors are published separately by
Patternity (docs CC-BY-4.0, vectors/schemas CC0).
