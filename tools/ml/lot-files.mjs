// Reads and checks the lot-level JSONL files shared by evaluate.mjs and
// naive-reference.mjs. Every check fails closed with a refusal code, so a bad
// file stops the run instead of quietly shrinking or skewing the comparison.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const TARGETS = Object.freeze(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);

// Scrap rates in prepagent.lots (rate_*_pct) are percentages of the lot, so
// errors and deltas are in percentage points. One unit for every file avoids
// comparing a fraction with a percentage.
export const RATE_UNIT = "pp";

export class RefusalError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "RefusalError";
    this.code = code;
  }
}

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function parseJsonl(text, name) {
  const entries = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === "") return;
    const line = index + 1;
    let row;
    try {
      row = JSON.parse(raw);
    } catch (error) {
      throw new RefusalError("BAD_JSON", `${name} line ${line}: ${error.message}`);
    }
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      throw new RefusalError("BAD_JSON", `${name} line ${line}: expected one JSON object per line`);
    }
    entries.push({ line, row });
  });
  return entries;
}

export function readLotFile(path, name) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new RefusalError("UNREADABLE_FILE", `${name} ${path}: ${error.code ?? error.message}`);
  }
  return { name, path, sha256: sha256(text), entries: parseJsonl(text, name) };
}

// Returns the lot IDs in file order after checking each is a non-empty string
// that appears once.
export function checkLotIds(file) {
  const seen = new Map();
  for (const { line, row } of file.entries) {
    const lotId = row.lotId;
    if (typeof lotId !== "string" || lotId.trim() === "") {
      throw new RefusalError("MISSING_LOT_ID", `${file.name} line ${line}: lotId must be a non-empty string`);
    }
    if (seen.has(lotId)) {
      throw new RefusalError(
        "DUPLICATE_LOT",
        `${file.name} lot ${lotId} appears on lines ${seen.get(lotId)} and ${line}`,
      );
    }
    seen.set(lotId, line);
  }
  return [...seen.keys()];
}

export function checkUnits(file) {
  for (const { line, row } of file.entries) {
    if (row.unit === undefined || row.unit === null || row.unit === "") {
      throw new RefusalError("MISSING_UNIT", `${file.name} line ${line} (lot ${row.lotId}): unit is missing; expected "${RATE_UNIT}"`);
    }
    if (row.unit !== RATE_UNIT) {
      throw new RefusalError(
        "UNIT_MISMATCH",
        `${file.name} line ${line} (lot ${row.lotId}): unit "${row.unit}" does not match "${RATE_UNIT}"`,
      );
    }
  }
}

export function finiteNumber(value, where) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RefusalError("NON_FINITE", `${where}: ${JSON.stringify(value) ?? String(value)} is not a finite number`);
  }
  return value;
}

// Returns Map(lotId -> { target: rate }). An absent or null rate is a missing
// value (missingCode); anything else that is not a finite number is NON_FINITE.
// JSON.parse turns 1e999 into Infinity, so the finite check is reachable from a file.
export function readRates(file, targets, missingCode) {
  const rates = new Map();
  for (const { line, row } of file.entries) {
    const source = row.rates;
    const values = {};
    for (const target of targets) {
      const value = source !== null && typeof source === "object" ? source[target] : undefined;
      if (value === undefined || value === null) {
        throw new RefusalError(missingCode, `${file.name} line ${line} (lot ${row.lotId}): no ${target} rate`);
      }
      values[target] = finiteNumber(value, `${file.name} line ${line} (lot ${row.lotId}) ${target}`);
    }
    rates.set(row.lotId, values);
  }
  return rates;
}

export function parseTargets(text) {
  if (text === undefined) return [...TARGETS];
  const targets = text.split(",").map((part) => part.trim().toUpperCase()).filter(Boolean);
  const unknown = targets.filter((target) => !TARGETS.includes(target));
  if (targets.length === 0 || unknown.length > 0) {
    throw new RefusalError("USAGE", `--targets must list some of ${TARGETS.join(",")}; got "${text}"`);
  }
  return [...new Set(targets)];
}
