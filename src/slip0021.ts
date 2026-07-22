import { createHmac } from "node:crypto";

/**
 * SLIP-0021 symmetric key derivation.
 *
 * This module implements SLIP-0021 exactly and without modification. NDK does not
 * introduce a new key derivation function; it only fixes how a named descriptor is
 * compiled into the ordered labels fed to this construction.
 *
 * Reference: https://github.com/satoshilabs/slips/blob/master/slip-0021.md
 *
 *   m               = HMAC-SHA512(key = "Symmetric key seed", msg = S)
 *   ChildNode(N, l) = HMAC-SHA512(key = N[0:32], msg = 0x00 || l)
 *   Key(N)          = N[32:64]
 */

const ROOT_KEY = Buffer.from("Symmetric key seed", "utf8");

/** A SLIP-0021 node is 64 bytes: N[0:32] is the child chain key, N[32:64] is Key(N). */
export type Slip0021Node = Uint8Array;

function hmacSha512(key: Uint8Array, message: Uint8Array): Buffer {
  return createHmac("sha512", key).update(message).digest();
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
  const labelBytes = Buffer.from(label, "utf8");
  const message = Buffer.allocUnsafe(1 + labelBytes.length);
  message[0] = 0x00;
  labelBytes.copy(message, 1);
  return hmacSha512(parent.subarray(0, 32), message);
}

/** Extract Key(N) = N[32:64] as a fresh, independent 32-byte array. */
export function nodeKey(node: Slip0021Node): Uint8Array {
  return Uint8Array.prototype.slice.call(node, 32, 64);
}
