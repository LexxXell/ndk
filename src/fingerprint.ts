import { createHash } from "node:crypto";
import type { NdkDescriptor } from "./types.js";
import { compileLabels } from "./compile.js";

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
  const digest = createHash("sha256").update(labels.join("\n"), "utf8").digest();
  return digest.subarray(0, 8).toString("hex");
}
