import type { ValidationResult, ValidationError } from "./types.js";
import { validateDescriptor } from "./validate.js";

/**
 * Strict JSON parsing for the text boundary (files, stdin, network).
 *
 * `JSON.parse` silently collapses duplicate object keys (last value wins), which SPEC.md
 * §10 forbids. It also cannot distinguish the integer `1` from the float `1.0` (both
 * become the number 1), which SPEC.md §8.1 requires. This module implements a small,
 * dependency-free JSON parser that:
 *
 *   - rejects duplicate property names at any object level (`duplicate-property`);
 *   - rejects malformed JSON (`invalid-json`);
 *   - records the raw source token of each number so callers can require that `ndk` be
 *     an integer literal (`invalid-value`).
 *
 * The core `validateDescriptor` still operates on already-materialized objects; this
 * parser is the strict front door for untrusted JSON text.
 */

class JsonSyntaxError extends Error {}

class DuplicateKeyError extends Error {
  constructor(public readonly pointer: string) {
    super(`duplicate property name at ${pointer || "/"}`);
  }
}

interface Parsed {
  value: unknown;
  /** JSON Pointer -> raw source token, for every number in the document. */
  numberTokens: Map<string, string>;
}

const WS = new Set([" ", "\t", "\n", "\r"]);

function strictParse(text: string): Parsed {
  let i = 0;
  const numberTokens = new Map<string, string>();

  function fail(msg: string): never {
    throw new JsonSyntaxError(`${msg} at position ${i}`);
  }

  function skipWs(): void {
    while (i < text.length && WS.has(text[i] as string)) i++;
  }

  function parseValue(pointer: string): unknown {
    skipWs();
    if (i >= text.length) fail("unexpected end of input");
    const ch = text[i] as string;
    if (ch === "{") return parseObject(pointer);
    if (ch === "[") return parseArray(pointer);
    if (ch === '"') return parseString();
    if (ch === "-" || (ch >= "0" && ch <= "9")) return parseNumber(pointer);
    if (text.startsWith("true", i)) {
      i += 4;
      return true;
    }
    if (text.startsWith("false", i)) {
      i += 5;
      return false;
    }
    if (text.startsWith("null", i)) {
      i += 4;
      return null;
    }
    return fail(`unexpected token '${ch}'`);
  }

  function parseObject(pointer: string): Record<string, unknown> {
    i++; // consume {
    const obj: Record<string, unknown> = {};
    const seen = new Set<string>();
    skipWs();
    if (text[i] === "}") {
      i++;
      return obj;
    }
    for (;;) {
      skipWs();
      if (text[i] !== '"') fail("expected property name");
      const key = parseString();
      if (seen.has(key)) throw new DuplicateKeyError(`${pointer}/${key}`);
      seen.add(key);
      skipWs();
      if (text[i] !== ":") fail("expected ':'");
      i++;
      obj[key] = parseValue(`${pointer}/${key}`);
      skipWs();
      const sep = text[i];
      if (sep === ",") {
        i++;
        continue;
      }
      if (sep === "}") {
        i++;
        return obj;
      }
      return fail("expected ',' or '}'");
    }
  }

  function parseArray(pointer: string): unknown[] {
    i++; // consume [
    const arr: unknown[] = [];
    skipWs();
    if (text[i] === "]") {
      i++;
      return arr;
    }
    for (;;) {
      arr.push(parseValue(`${pointer}/${arr.length}`));
      skipWs();
      const sep = text[i];
      if (sep === ",") {
        i++;
        continue;
      }
      if (sep === "]") {
        i++;
        return arr;
      }
      return fail("expected ',' or ']'");
    }
  }

  function parseString(): string {
    i++; // consume opening quote
    let out = "";
    for (;;) {
      if (i >= text.length) fail("unterminated string");
      const ch = text[i++] as string;
      if (ch === '"') return out;
      if (ch === "\\") {
        const esc = text[i++] as string;
        switch (esc) {
          case '"': out += '"'; break;
          case "\\": out += "\\"; break;
          case "/": out += "/"; break;
          case "b": out += "\b"; break;
          case "f": out += "\f"; break;
          case "n": out += "\n"; break;
          case "r": out += "\r"; break;
          case "t": out += "\t"; break;
          case "u": {
            const hex = text.slice(i, i + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("invalid \\u escape");
            out += String.fromCharCode(parseInt(hex, 16));
            i += 4;
            break;
          }
          default:
            return fail(`invalid escape '\\${esc}'`);
        }
      } else if (ch.charCodeAt(0) <= 0x1f) {
        fail("unescaped control character in string");
      } else {
        out += ch;
      }
    }
  }

  function parseNumber(pointer: string): number {
    const start = i;
    if (text[i] === "-") i++;
    while (i < text.length && text[i]! >= "0" && text[i]! <= "9") i++;
    if (text[i] === ".") {
      i++;
      while (i < text.length && text[i]! >= "0" && text[i]! <= "9") i++;
    }
    if (text[i] === "e" || text[i] === "E") {
      i++;
      if (text[i] === "+" || text[i] === "-") i++;
      while (i < text.length && text[i]! >= "0" && text[i]! <= "9") i++;
    }
    const raw = text.slice(start, i);
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
      fail(`invalid number '${raw}'`);
    }
    numberTokens.set(pointer, raw);
    return Number(raw);
  }

  const value = parseValue("");
  skipWs();
  if (i !== text.length) fail("trailing content after JSON value");
  return { value, numberTokens };
}

function err(path: string, code: string, message: string): ValidationError {
  return { path, code, message };
}

/**
 * Parse untrusted JSON text into a validated NDK descriptor.
 *
 * Applies the strict text-layer checks (duplicate keys, malformed JSON, integer-literal
 * `ndk`) and then the full semantic validation of `validateDescriptor`.
 */
export function parseDescriptor(text: string): ValidationResult {
  let parsed: Parsed;
  try {
    parsed = strictParse(text);
  } catch (e) {
    if (e instanceof DuplicateKeyError) {
      return { valid: false, errors: [err(e.pointer, "duplicate-property", e.message)] };
    }
    const message = e instanceof Error ? e.message : String(e);
    return { valid: false, errors: [err("", "invalid-json", message)] };
  }

  const textErrors: ValidationError[] = [];
  const ndkRaw = parsed.numberTokens.get("/ndk");
  if (ndkRaw !== undefined && !/^-?\d+$/.test(ndkRaw)) {
    // e.g. "ndk": 1.0 — a non-integer literal, even though it parses to the number 1.
    textErrors.push(err("/ndk", "invalid-value", "ndk must be the integer 1"));
  }

  const result = validateDescriptor(parsed.value);
  if (!result.valid) {
    return { valid: false, errors: [...textErrors, ...result.errors] };
  }
  if (textErrors.length > 0) {
    return { valid: false, errors: textErrors };
  }
  return result;
}
