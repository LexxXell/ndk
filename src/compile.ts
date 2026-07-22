import type { NdkDescriptor } from "./types.js";
import { assertDescriptor } from "./validate.js";

/**
 * Represent a JSON integer as its ASCII decimal string, with no leading zeros,
 * sign, decimal point, or surrounding whitespace.
 */
function decimalInteger(n: number): string {
  if (!Number.isInteger(n)) {
    throw new Error("expected an integer");
  }
  return String(n);
}

/**
 * Compile a validated descriptor into the five ordered SLIP-0021 labels.
 *
 * The order is fixed and does not depend on JSON property order. Values are used
 * verbatim after validation — never sorted, trimmed, case-folded, or normalized.
 */
export function compileLabels(descriptor: NdkDescriptor): readonly string[] {
  // Defensive: ensure the object still satisfies the contract before compiling.
  const d = assertDescriptor(descriptor);
  return [
    "ndk:" + decimalInteger(d.ndk),
    "subject:" + d.subject,
    "purpose:" + d.purpose,
    "profile:" + d.profile,
    "type:" + d.type,
  ];
}
