/**
 * NDK — Named Deterministic Keys.
 *
 * Reference implementation of the NDK-1 convention: deterministic derivation of a
 * 32-byte seed from a master secret and a small, human-readable JSON descriptor,
 * using SLIP-0021 without modification.
 *
 * This package is a reference implementation. The convention it implements is
 * maintained separately (Patternity/ndk-spec); this implementation does not define
 * normative behavior.
 */
export type {
  NdkDescriptor,
  ValidationError,
  ValidationResult,
  ValidationSuccess,
  ValidationFailure,
} from "./types.js";
export { LABEL_KEYS } from "./types.js";
export { validateDescriptor, assertDescriptor } from "./validate.js";
export { parseDescriptor } from "./parse.js";
export { compileLabels } from "./compile.js";
export { deriveSeed, deriveSeedHex } from "./derive.js";
export { descriptorFingerprint } from "./fingerprint.js";
export { rootNode, childNode, nodeKey } from "./slip0021.js";
