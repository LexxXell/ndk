import type {
  NdkDescriptor,
  ValidationError,
  ValidationResult,
} from "./types.js";

/**
 * Semantic validation of an already-materialized descriptor object.
 *
 * This function validates a JavaScript object, not JSON text. Concerns that only
 * exist at the text level — duplicate property names, in particular — must be handled
 * by a strict parser before an object reaches this function (see parseDescriptor).
 */

// Allowed descriptor properties. Anything else is rejected (no extra core fields).
const ALLOWED_KEYS = new Set(["ndk", "subject", "purpose", "profile", "type"]);

// The scheme-like prefix before the first ":" in subject.
const SUBJECT_PREFIX_RE = /^[a-z][a-z0-9+.-]*$/;
// purpose and type: lowercase hyphen-separated tokens.
const TOKEN_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// profile: like a token but also allows "." and ":" as internal separators.
const PROFILE_RE = /^[a-z0-9]+(?:[.:-][a-z0-9]+)*$/;

function err(path: string, code: string, message: string): ValidationError {
  return { path, code, message };
}

/** True if the string is a control character (C0, DEL, or C1) or contains NUL. */
function hasForbiddenControl(value: string): boolean {
  for (const ch of value) {
    const cp = ch.codePointAt(0) as number;
    if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return true;
  }
  return false;
}

function hasEdgeWhitespace(value: string): boolean {
  return value.length !== value.trim().length;
}

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function validateSubject(value: unknown, errors: ValidationError[]): void {
  if (typeof value !== "string") {
    errors.push(err("/subject", "invalid-type", "subject must be a string"));
    return;
  }
  const bytes = utf8ByteLength(value);
  if (bytes < 1 || bytes > 1024) {
    errors.push(
      err("/subject", "invalid-length", "subject must be 1..1024 UTF-8 bytes"),
    );
  }
  if (value.normalize("NFC") !== value) {
    errors.push(err("/subject", "not-nfc", "subject must be Unicode NFC"));
  }
  if (hasForbiddenControl(value)) {
    errors.push(
      err("/subject", "control-char", "subject must not contain control characters"),
    );
  }
  if (hasEdgeWhitespace(value)) {
    errors.push(
      err("/subject", "edge-whitespace", "subject must not begin or end with whitespace"),
    );
  }
  const colon = value.indexOf(":");
  if (colon < 0) {
    errors.push(err("/subject", "missing-scheme", "subject must contain at least one ':'"));
  } else if (!SUBJECT_PREFIX_RE.test(value.slice(0, colon))) {
    errors.push(
      err("/subject", "invalid-scheme", "subject scheme prefix must match ^[a-z][a-z0-9+.-]*$"),
    );
  }
}

function validateToken(
  value: unknown,
  path: string,
  max: number,
  errors: ValidationError[],
): void {
  if (typeof value !== "string") {
    errors.push(err(path, "invalid-type", `${path.slice(1)} must be a string`));
    return;
  }
  if (value.length < 1 || value.length > max) {
    errors.push(err(path, "invalid-length", `${path.slice(1)} must be 1..${max} ASCII chars`));
  }
  if (!TOKEN_RE.test(value)) {
    errors.push(
      err(path, "invalid-format", `${path.slice(1)} must be a lowercase token`),
    );
  }
}

function validateProfile(value: unknown, errors: ValidationError[]): void {
  if (typeof value !== "string") {
    errors.push(err("/profile", "invalid-type", "profile must be a string"));
    return;
  }
  if (value.length < 1 || value.length > 128) {
    errors.push(err("/profile", "invalid-length", "profile must be 1..128 ASCII chars"));
  }
  if (!PROFILE_RE.test(value)) {
    errors.push(err("/profile", "invalid-format", "profile must be a lowercase identifier"));
  }
}

/**
 * Validate an arbitrary value as an NDK-1 descriptor.
 *
 * On success, returns the value narrowed to NdkDescriptor. Field byte values are
 * preserved exactly: this function never normalizes, trims, or changes case.
 */
export function validateDescriptor(value: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      valid: false,
      errors: [err("", "not-an-object", "descriptor must be a JSON object")],
    };
  }

  const obj = value as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(err(`/${key}`, "unknown-property", `unknown property: ${key}`));
    }
  }

  if (!("ndk" in obj)) {
    errors.push(err("/ndk", "missing", "ndk is required"));
  } else if (obj.ndk !== 1) {
    // Note: JSON 1.0 parses to the number 1 and would pass here. The distinction
    // between integer 1 and 1.0 only exists at the JSON text level; if that matters,
    // reject it before parsing. The string "1" is rejected here.
    errors.push(err("/ndk", "invalid-value", "ndk must be the integer 1"));
  }

  if (!("subject" in obj)) errors.push(err("/subject", "missing", "subject is required"));
  else validateSubject(obj.subject, errors);

  if (!("purpose" in obj)) errors.push(err("/purpose", "missing", "purpose is required"));
  else validateToken(obj.purpose, "/purpose", 64, errors);

  if (!("profile" in obj)) errors.push(err("/profile", "missing", "profile is required"));
  else validateProfile(obj.profile, errors);

  if (!("type" in obj)) errors.push(err("/type", "missing", "type is required"));
  else validateToken(obj.type, "/type", 64, errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, descriptor: obj as unknown as NdkDescriptor };
}

/** Validate and throw on failure, returning the narrowed descriptor. */
export function assertDescriptor(value: unknown): NdkDescriptor {
  const result = validateDescriptor(value);
  if (!result.valid) {
    const first = result.errors[0] ?? {
      path: "",
      code: "invalid",
      message: "invalid descriptor",
    };
    throw new Error(`invalid NDK descriptor: ${first.path} ${first.code}: ${first.message}`);
  }
  return result.descriptor;
}
