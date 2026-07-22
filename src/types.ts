/**
 * The NDK-1 descriptor: a named derivation context.
 *
 * Exactly five properties, all lowercase. Property order in JSON is irrelevant to
 * derivation; implementations MUST read fields by name and compile labels in the
 * normative order (ndk, subject, purpose, profile, type).
 */
export interface NdkDescriptor {
  /** Major NDK version. MUST be the integer 1. */
  readonly ndk: 1;
  /** Human-readable, self-describing subject the seed is derived for. */
  readonly subject: string;
  /** Stable role the seed plays (lowercase token). */
  readonly purpose: string;
  /**
   * Downstream context: network / coin / variant. Opaque to NDK derivation.
   * A trailing ":N" generation suffix MAY be used for rotation by convention.
   */
  readonly profile: string;
  /**
   * The seed->key transform (e.g. "bip32-seed", "ed25519-seed"). Opaque to the
   * NDK core: it is validated as a token and used as a derivation label, but the
   * NDK core does not implement the transform. Transform semantics are defined by
   * the separate, independently-versioned NDK Profiles specification.
   */
  readonly type: string;
}

/** A single structured validation error. Codes are stable across patch releases. */
export interface ValidationError {
  /** JSON Pointer to the offending value, e.g. "/purpose". */
  readonly path: string;
  /** Stable machine-readable error code, e.g. "invalid-format". */
  readonly code: string;
  /** Human-readable message. Not normative. */
  readonly message: string;
}

export interface ValidationSuccess {
  readonly valid: true;
  readonly descriptor: NdkDescriptor;
}

export interface ValidationFailure {
  readonly valid: false;
  readonly errors: readonly ValidationError[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/** The five normative label keys, in derivation order. */
export const LABEL_KEYS = [
  "ndk",
  "subject",
  "purpose",
  "profile",
  "type",
] as const;
