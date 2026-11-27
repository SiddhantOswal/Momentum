// Prints a hash of everything the built pages are made from, so a test can tell when public/site is stale.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const tracked = ["index.html", "login.html", "package.json", "package-lock.json", "vite.config.js", "vite.login.config.js", "THIRD_PARTY_NOTICES.txt"];

function walk(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function sourceHash() {
  const files = [...tracked.map((name) => join(root, name)), ...walk(join(root, "src"))];
  const hash = createHash("sha256");
  for (const file of files) hash.update(relative(root, file)).update("\0").update(readFileSync(file)).update("\0");
  return hash.digest("hex");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(sourceHash());
