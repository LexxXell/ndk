#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseDescriptor } from "./parse.js";
import { compileLabels } from "./compile.js";
import { deriveSeedHex } from "./derive.js";
import { descriptorFingerprint } from "./fingerprint.js";
import type { NdkDescriptor } from "./types.js";

/**
 * NDK reference CLI. Intended for testing and demonstration.
 *
 * Security (SPEC.md SECURITY §7): the master secret is NEVER accepted as a command-line
 * argument. It is read only from a protected file (--seed-file) or standard input
 * (--seed-stdin), as lowercase/uppercase hex. Diagnostics go to stderr; machine output
 * goes to stdout. Exit code is non-zero on any validation or derivation failure. Secrets
 * are never printed; only the `derive` command prints the derived seed, which the user
 * explicitly requested.
 */

const USAGE = `ndk — Named Deterministic Keys (reference CLI, for testing/demo)

Usage:
  ndk validate <descriptor.json>
  ndk labels <descriptor.json>
  ndk fingerprint <descriptor.json>
  ndk derive <descriptor.json> (--seed-file <hex-file> | --seed-stdin)

Notes:
  - The master secret is read as hex from a file or stdin only, never from arguments.
  - 'derive' prints the 32-byte NDK seed as hex to stdout.
  - Exit code is non-zero on failure.
`;

function die(message: string, code = 1): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function readDescriptor(path: string): NdkDescriptor {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    die(`cannot read descriptor file: ${path}`);
  }
  const result = parseDescriptor(text);
  if (!result.valid) {
    process.stderr.write(JSON.stringify({ valid: false, errors: result.errors }, null, 2) + "\n");
    process.exit(1);
  }
  return result.descriptor;
}

function readMasterSecret(args: Map<string, string | boolean>): Uint8Array {
  let hex: string;
  if (args.has("seed-file")) {
    const path = args.get("seed-file");
    if (typeof path !== "string") die("--seed-file requires a path");
    try {
      hex = readFileSync(path, "utf8");
    } catch {
      die(`cannot read seed file: ${path}`);
    }
  } else if (args.has("seed-stdin")) {
    try {
      hex = readFileSync(0, "utf8"); // fd 0 = stdin
    } catch {
      die("cannot read master secret from stdin");
    }
  } else {
    die("derive requires --seed-file <path> or --seed-stdin (never pass secrets as arguments)");
  }
  const clean = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    die("master secret must be valid hex (even length)");
  }
  if (clean.length === 0) die("master secret is empty");
  return Uint8Array.from(Buffer.from(clean, "hex"));
}

function parseArgs(argv: string[]): { positional: string[]; flags: Map<string, string | boolean> } {
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, next);
        i++;
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function main(): void {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  const file = positional[1];

  if (!command || command === "help" || flags.has("help")) {
    process.stdout.write(USAGE);
    process.exit(command ? 0 : 1);
  }

  if (command !== "derive" && command !== "validate" && command !== "labels" && command !== "fingerprint") {
    die(`unknown command: ${command}\n\n${USAGE}`);
  }
  if (!file) die(`${command} requires a descriptor file path`);

  switch (command) {
    case "validate": {
      readDescriptor(file); // exits non-zero on failure
      process.stdout.write(JSON.stringify({ valid: true }) + "\n");
      break;
    }
    case "labels": {
      const d = readDescriptor(file);
      process.stdout.write(JSON.stringify(compileLabels(d)) + "\n");
      break;
    }
    case "fingerprint": {
      const d = readDescriptor(file);
      process.stdout.write(descriptorFingerprint(d) + "\n");
      break;
    }
    case "derive": {
      const d = readDescriptor(file);
      const master = readMasterSecret(flags);
      process.stdout.write(deriveSeedHex(master, d) + "\n");
      break;
    }
  }
}

main();
