import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import { startIndexServer, stopAllStarted } from "./helpers/server.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STARTUP_TEST_TIMEOUT_MS = 30000;

afterEach(stopAllStarted);

const read = (relative) => readFileSync(join(ROOT, relative), "utf8");

function dockerignoreConfigAllowlist() {
  return read(".dockerignore").split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => /^!config\/([^/*?[\]]+)$/.exec(line)?.[1])
    .filter(Boolean);
}

// python3 cannot always be started from Node on developer laptops, so the
// release tool's lists are read as text rather than by running it.
function pythonStringList(source, name) {
  const match = new RegExp(`^${name}\\s*=\\s*\\[([^\\]]*)\\]`, "m").exec(source);
  assert.ok(match, `${name} not found in tools/prepare-release-snapshot.py`);
  const items = [...match[1].matchAll(/'([^'\\]+)'/g)].map((item) => item[1]);
  assert.equal(match[1].replace(/'[^'\\]+'/g, "").replace(/[\s,]/g, ""), "",
    `${name} is no longer a plain list of quoted names; update this parser`);
  return items;
}

function snapshotLists() {
  const source = read("tools/prepare-release-snapshot.py");
  const directories = /for directory in \[([^\]]*)\]:/.exec(source);
  assert.ok(directories, "the snapshot directory loop was not found in tools/prepare-release-snapshot.py");
  return {
    rootFiles: pythonStringList(source, "ROOT_FILES"),
    configFiles: pythonStringList(source, "CONFIG_FILES"),
    directories: pythonStringList(`DIRECTORIES = [${directories[1]}]`, "DIRECTORIES"),
  };
}

function sourceFiles(directory) {
  return readdirSync(join(ROOT, directory), { recursive: true })
    .map((name) => join(directory, name))
    .filter((path) => /\.(m?js)$/.test(path) && statSync(join(ROOT, path)).isFile());
}

function referencedConfigFiles() {
  const referenced = new Set();
  for (const path of ["index.mjs", ...sourceFiles("src")]) {
    for (const match of read(path).matchAll(/config\/([A-Za-z0-9_.-]+\.json)/g)) referenced.add(match[1]);
  }
  return [...referenced].sort();
}

function promptIds() {
  const { roles } = JSON.parse(read("config/arc-models.json"));
  return [...new Set(Object.values(roles).map((role) => role.prompt).filter(Boolean))].sort();
}

function dockerCopySources() {
  return read("Dockerfile").split(/\r?\n/)
    .filter((line) => /^\s*COPY\b/.test(line))
    .flatMap((line) => line.trim().split(/\s+/).slice(1).filter((word) => !word.startsWith("--")).slice(0, -1));
}

test("the scan finds the config files Arc loads when the server starts", () => {
  const referenced = referencedConfigFiles();
  for (const name of ["arc.json", "arc-scope.json", "arc-metrics.json", "arc-models.json", "model-acceptance.json"]) {
    assert.ok(referenced.includes(name), `scan missed config/${name}`);
  }
  for (const name of referenced) {
    assert.ok(existsSync(join(ROOT, "config", name)), `index.mjs or src/ names config/${name}, which does not exist`);
  }
});

test("every config file the server reads is in the .dockerignore allowlist and the release snapshot", () => {
  const allowlist = dockerignoreConfigAllowlist();
  const { configFiles } = snapshotLists();
  const referenced = referencedConfigFiles();
  assert.deepEqual({
    ".dockerignore": referenced.filter((name) => !allowlist.includes(name)),
    CONFIG_FILES: referenced.filter((name) => !configFiles.includes(name)),
  }, { ".dockerignore": [], CONFIG_FILES: [] }, "config files the server reads but a release list leaves out");
});

test("every prompt named in config/arc-models.json ships with the image and the release snapshot", () => {
  const ids = promptIds();
  assert.ok(ids.length > 0, "config/arc-models.json names no prompts");
  assert.ok(dockerCopySources().includes("prompts"), "the Dockerfile does not copy prompts/");
  assert.ok(snapshotLists().directories.includes("prompts"), "the release snapshot does not include prompts/");
  const excluding = read(".dockerignore").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!") && /^\/?prompts(\/|$)/.test(line));
  assert.deepEqual(excluding, [], ".dockerignore excludes prompt files");
  for (const id of ids) {
    assert.ok(existsSync(join(ROOT, "prompts", id, "system.txt")), `prompts/${id}/system.txt is missing`);
  }
});

function rootNodeModules() {
  for (let directory = ROOT; ; directory = dirname(directory)) {
    if (existsSync(join(directory, "node_modules", "hono", "package.json"))) return join(directory, "node_modules");
    assert.notEqual(dirname(directory), directory, "node_modules not found above the repository");
  }
}

// Only files that both lists ship reach a release image: the snapshot tool
// decides what is uploaded and .dockerignore decides what the build copies.
function buildShippedTree(destination) {
  const allowlist = dockerignoreConfigAllowlist();
  const { rootFiles, configFiles, directories } = snapshotLists();
  for (const source of dockerCopySources()) {
    if (source === "config") {
      mkdirSync(join(destination, "config"));
      for (const name of configFiles.filter((file) => allowlist.includes(file))) {
        cpSync(join(ROOT, "config", name), join(destination, "config", name));
      }
      continue;
    }
    assert.ok(rootFiles.includes(source) || directories.includes(source),
      `the Dockerfile copies ${source}, which the release snapshot does not include`);
    cpSync(join(ROOT, source), join(destination, source), { recursive: true });
  }
  // The image runs npm ci --omit=dev; linking the installed tree stands in for it without a network.
  symlinkSync(rootNodeModules(), join(destination, "node_modules"), "dir");
}

test("the server starts from only the files a release image ships", { timeout: STARTUP_TEST_TIMEOUT_MS }, async () => {
  const destination = mkdtempSync(join(tmpdir(), "momentum-shipped-"));
  try {
    buildShippedTree(destination);
    const { port, startupMessage } = await startIndexServer(
      { PATH: process.env.PATH, NODE_ENV: "production" },
      { entry: join(destination, "index.mjs"), cwd: destination },
    );
    assert.equal(startupMessage, `Momentum production prep running at http://localhost:${port}`);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
  } finally {
    await stopAllStarted();
    rmSync(destination, { recursive: true, force: true });
  }
});
