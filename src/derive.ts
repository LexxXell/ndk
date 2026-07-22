import type { NdkDescriptor } from "./types.js";
import { compileLabels } from "./compile.js";
import { childNode, nodeKey, rootNode } from "./slip0021.js";

/**
 * Derive the 32-byte NDK seed for a descriptor from a master secret.
 *
 * The result is a fresh Uint8Array. The caller's master secret buffer is never
 * mutated. The returned value is opaque seed material — it is NOT itself a private
 * key, wallet seed phrase, or extended key. Converting it into a downstream key is
 * the job of the transform named by descriptor.type (see the NDK Profiles spec).
 */
export function deriveSeed(
  masterSecret: Uint8Array,
  descriptor: NdkDescriptor,
): Uint8Array {
  const labels = compileLabels(descriptor);
  let node = rootNode(masterSecret);
  for (const label of labels) {
    node = childNode(node, label);
  }
  return nodeKey(node);
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/** Convenience: derive the NDK seed and return it as a lowercase hex string. */
export function deriveSeedHex(
  masterSecret: Uint8Array,
  descriptor: NdkDescriptor,
): string {
  return toHex(deriveSeed(masterSecret, descriptor));
}
