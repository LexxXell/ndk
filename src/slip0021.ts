import { hmac } from "@noble/hashes/hmac.js";
import { sha512 } from "@noble/hashes/sha2.js";

/**
 * SLIP-0021 symmetric key derivation.
 *
 * This module implements SLIP-0021 exactly and without modification. NDK does not
 * introduce a new key derivation function; it only fixes how a named descriptor is
 * compiled into the ordered labels fed to this construction.
 *
 * It is isomorphic (Node and browsers): HMAC-SHA512 comes from @noble/hashes and all
 * byte handling uses Uint8Array / TextEncoder, so there is no dependency on node:crypto
 * or Buffer.
 *
 * Reference: https://github.com/satoshilabs/slips/blob/master/slip-0021.md
 *
 *   m               = HMAC-SHA512(key = "Symmetric key seed", msg = S)
 *   ChildNode(N, l) = HMAC-SHA512(key = N[0:32], msg = 0x00 || l)
 *   Key(N)          = N[32:64]
 */

const encoder = new TextEncoder();
const ROOT_KEY = encoder.encode("Symmetric key seed");

/** A SLIP-0021 node is 64 bytes: N[0:32] is the child chain key, N[32:64] is Key(N). */
export type Slip0021Node = Uint8Array;

function hmacSha512(key: Uint8Array, message: Uint8Array): Uint8Array {
  return hmac(sha512, key, message);
}

/** Compute the SLIP-0021 master node from a master secret S. */
export function rootNode(masterSecret: Uint8Array): Slip0021Node {
  if (masterSecret.length === 0) {
    // SLIP-0021 does not forbid an empty secret, but an empty master secret has no
    // entropy and would be an operator error; NDK's own callers guard against it.
    throw new Error("master secret must not be empty");
  }
  return hmacSha512(ROOT_KEY, masterSecret);
}

/** Derive a child node from a parent node using a UTF-8 label. */
export function childNode(parent: Slip0021Node, label: string): Slip0021Node {
  const labelBytes = encoder.encode(label);
  const message = new Uint8Array(1 + labelBytes.length);
  message[0] = 0x00;
  message.set(labelBytes, 1);
  return hmacSha512(parent.subarray(0, 32), message);
}

/** Extract Key(N) = N[32:64] as a fresh, independent 32-byte array. */
export function nodeKey(node: Slip0021Node): Uint8Array {
  return node.slice(32, 64);
}
