import { sha256 } from "@noble/hashes/sha2.js";
import type { NdkDescriptor } from "./types.js";
import { compileLabels } from "./compile.js";

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Compute a non-secret descriptor fingerprint.
 *
 * The fingerprint is SHA-256 over the compiled labels joined by newline, truncated
 * to the first 8 bytes and rendered as lowercase hex (16 characters).
 *
 * The master secret is NOT involved: the fingerprint depends only on the descriptor.
 * It is therefore safe to log and compare in CI to detect accidental descriptor drift,
 * and it never reveals anything about the derived seed. Newline is a forbidden label
 * character, so the join is unambiguous.
 */
export function descriptorFingerprint(descriptor: NdkDescriptor): string {
  const labels = compileLabels(descriptor);
  const digest = sha256(new TextEncoder().encode(labels.join("\n")));
  return toHex(digest.subarray(0, 8));
}
