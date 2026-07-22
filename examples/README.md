# NDK examples

These examples are **not** part of the published npm package. They depend on audited
third-party libraries (`@noble/*`, `@scure/*`) that are `devDependencies` only — the NDK
core stays blockchain-agnostic and dependency-free. Run them after building:

```sh
npm run build
node examples/universal-demo.mjs
```

## The big picture: one root → any key

NDK's output is deliberately **universal**. The 32-byte NDK seed becomes any downstream
object through the transform named by `type` (see the
[NDK Profiles](https://github.com/Patternity/ndk/blob/master/SPEC-PROFILES.md) spec). So a
single master secret plus a set of small public descriptors can produce keys for **any**
blockchain, SSH, signing tools, and symmetric secrets — all deterministic and recoverable.

```
master secret + descriptor ──NDK──▶ 32-byte seed ──type──▶ any output
   type=secp256k1-raw  → Ethereum / raw secp256k1 key
   type=bip32-seed     → Dash / Bitcoin / any secp256k1 HD wallet
   type=ed25519-seed   → Solana / SSH / Minisign
   type=hkdf-sha256    → symmetric secret (vault, encryption, API token)
```

[`universal-demo.mjs`](universal-demo.mjs) derives real addresses for Dash, Bitcoin,
Ethereum, Solana, an SSH public key, and a symmetric vault key — all from **one** master
secret.

## Dash Platform as a universal deterministic-key root (design)

The example uses a raw master-secret value, but the intended architecture uses **Dash
Platform** for both the secret source and the descriptor registry:

```
Dash Identity
  ├─ key[0] (master / authentication key)   ──▶  NDK master secret
  └─ documents (a data contract)            ──▶  NDK descriptors (public "profiles")

  for each stored descriptor:
      identity key + descriptor ──NDK──▶ seed ──type──▶ the key for that context
```

Why this fits NDK so well:

- **Descriptors are public by design.** Storing them as Platform documents matches NDK's
  model exactly — the descriptor is not a secret; only the master secret is. Recovery
  becomes "read my documents, re-derive."
- **The identity key is the master secret** (Appendix A.2 pattern: an identity/HD private
  key used as the master secret). One identity → every key you own, everywhere.
- **The output is any network/tool**, selected per document by `profile` + `type`.
- **Rotation** is a profile generation suffix (`dash:mainnet:2`) on the stored document.

### Boundaries and status

- The NDK core does **not** depend on Dash. The Dash Platform integration is an
  **input/storage** layer (identity key as master, documents as descriptors), not a change
  to derivation.
- Actually wiring the Dash Platform SDK / DashPlatformExtension (reading identity keys,
  reading/writing documents) is a **separate, later task** in the pshenmic Dash Platform
  ecosystem. This directory documents the design; the SDK code lives with that work.
- A reused wallet/identity key as master links NDK's compromise to that identity; for
  high-value contexts prefer a dedicated key. See the spec's `SECURITY.md`.

## Security note

Examples derive real keys. Do not feed a real master secret into an example on a shared or
untrusted machine, and never commit derived secrets. The `universal-demo.mjs` master value
is the public BIP-39 Trezor test key and is for illustration only.
