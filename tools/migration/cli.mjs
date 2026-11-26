// Reads docs/migration/queue.json and progress.json. No network, no writes.
//
//   node tools/migration/cli.mjs status
//   node tools/migration/cli.mjs next
//   node tools/migration/cli.mjs context <UnitId>
//   node tools/migration/cli.mjs validate
//   node tools/migration/cli.mjs handoff           check the handoff files against the disk
//   node tools/migration/cli.mjs handoff-refresh   rewrite the checksums of the frozen handoff files
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const queue = read("docs/migration/queue.json");
const progress = read("docs/migration/progress.json");
const inventory = read("docs/migration/03-design-inventory.json");
const units = new Map(queue.units.map((unit) => [unit.id, unit]));
const done = new Set(["UI_VERIFIED", "INTEGRATION_PENDING", "FUNCTIONALLY_VERIFIED", "RELEASE_READY"]);
const rank = { P0: 0, P1: 1, P2: 2 };
const stateOf = (id) => progress.units[id].state;
const depsMet = (unit) => unit.dependsOn.every((dep) => done.has(stateOf(dep)));

function eligible() {
  const order = queue.pilotOrder;
  return queue.units
    .filter((unit) => ["NOT_STARTED", "READY"].includes(stateOf(unit.id)) && depsMet(unit) && unit.hardBlockers.length === 0)
    .sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99) || rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id));
}

function git(...args) {
  try { return execFileSync("git", args, { encoding: "utf8" }).trim(); } catch { return "unknown"; }
}

function status() {
  const counts = {};
  for (const unit of queue.units) counts[stateOf(unit.id)] = (counts[stateOf(unit.id)] ?? 0) + 1;
  console.log(`branch ${git("branch", "--show-current")} @ ${git("rev-parse", "--short", "HEAD")} (base ${progress.baseSha.slice(0, 7)})`);
  console.log("foundation: " + Object.entries(progress.foundation.checkpoints).map(([k, v]) => `${k}=${v}`).join(" "));
  console.log("units: " + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));
  const failing = progress.checks.filter((check) => check.status === "FAILED");
  console.log(failing.length ? "failing checks: " + failing.map((check) => check.id).join(", ") : "failing checks: none recorded");
  for (const unit of queue.units) {
    const blocked = unit.hardBlockers.length ? ` hard-blocked: ${unit.hardBlockers.join(", ")}` : "";
    const waiting = !depsMet(unit) ? ` waits for ${unit.dependsOn.filter((dep) => !done.has(stateOf(dep))).join(", ")}` : "";
    console.log(`${unit.id} ${unit.priority} ${stateOf(unit.id).padEnd(21)} ${unit.name}${waiting}${blocked}`);
  }
}

function next() {
  const [pick] = eligible();
  if (!pick) { console.log("No unit is eligible. Run status to see what each unit waits for."); return; }
  console.log(`${pick.id} ${pick.name} (${pick.priority}${pick.pilot ? ", pilot" : ""})`);
  console.log(`route: ${pick.canonicalRoute}`);
  console.log(`design: ${pick.designScreens.join(", ") || "all"}`);
  console.log(`contract: ${pick.contract}`);
  console.log(`backend: ${pick.backendContracts.join("; ") || "none"}`);
  if (pick.openDecisions.length) console.log(`open decisions: ${pick.openDecisions.join(", ")} (see docs/migration/11-product-decisions.md)`);
  console.log(`start: /momentum-page ${pick.id}`);
}

function context(id) {
  const unit = units.get(id);
  if (!unit) { console.error(`Unknown unit ${id}`); process.exit(2); }
  const register = new Map(readFileSync("docs/migration/05-discrepancy-register.csv", "utf8").split(/\r?\n/).slice(1)
    .filter(Boolean).map((line) => [line.slice(0, line.indexOf(",")), line]));
  console.log(`# ${unit.id} ${unit.name}`);
  console.log(`route ${unit.canonicalRoute} | priority ${unit.priority} | state ${stateOf(id)} | depends on ${unit.dependsOn.join(", ") || "nothing"}`);
  console.log(`\nRead first: ${unit.contract}  and  docs/migration/00-execution-contract.md`);
  console.log("\nDesign (retrieve with node tools/design/extract.mjs <ScreenId> --theme dark|light):");
  for (const screen of inventory.screens.filter((entry) => unit.designScreens.includes(entry.id))) {
    console.log(`- ${screen.id}: docs/arc/design/source/png/{dark,light}/${screen.id}.png; buttons: ${screen.buttons.slice(0, 6).join(" | ") || "none"}`);
  }
  console.log(`\nAssets: ${unit.assets.join(", ") || "none"} (docs/arc/design/source/assets)`);
  console.log(`Shared components (web/src/ui/components.tsx): ${unit.sharedComponents.join(", ")}`);
  console.log(`Existing code: ${unit.existingCode.join("; ") || "none"}`);
  console.log(`Backend: ${unit.backendContracts.join("; ") || "none"}  (docs/migration/07-backend-contracts.md)`);
  console.log(`Open decisions: ${unit.openDecisions.join(", ") || "none"}`);
  console.log(`Tests: ${unit.tests.join("; ")}`);
  console.log("\nDiscrepancies (id, class, severity, description ... full row in 05-discrepancy-register.csv):");
  for (const key of unit.discrepancies) console.log(`- ${(register.get(key) ?? key).slice(0, 260)}`);
}

function validate() {
  const problems = [];
  const ids = queue.units.map((unit) => unit.id);
  if (new Set(ids).size !== ids.length) problems.push("duplicate unit ids");
  for (const unit of queue.units) {
    for (const dep of unit.dependsOn) if (!units.has(dep)) problems.push(`${unit.id}: unknown dependency ${dep}`);
    if (!existsSync(unit.contract)) problems.push(`${unit.id}: missing contract ${unit.contract}`);
    if (!progress.units[unit.id]) problems.push(`${unit.id}: no entry in progress.json`);
  }
  for (const id of Object.keys(progress.units)) {
    if (!units.has(id)) problems.push(`progress.json has unknown unit ${id}`);
    if (!progress.states.includes(stateOf(id))) problems.push(`${id}: invalid state ${stateOf(id)}`);
    const entry = progress.units[id];
    if (["UI_VERIFIED", "FUNCTIONALLY_VERIFIED", "RELEASE_READY"].includes(entry.state) && !(entry.visual.dark && entry.visual.light && entry.evidence.length))
      problems.push(`${id}: ${entry.state} needs dark and light verification and evidence`);
    if (entry.state === "FUNCTIONALLY_VERIFIED" && !entry.functional) problems.push(`${id}: FUNCTIONALLY_VERIFIED without a functional result`);
  }
  // Dependency cycles.
  const visiting = new Set(), visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return; if (visiting.has(id)) { problems.push(`dependency cycle at ${id}`); return; }
    visiting.add(id); units.get(id)?.dependsOn.forEach(visit); visiting.delete(id); visited.add(id);
  };
  ids.forEach(visit);
  // Every approved screen belongs to exactly one unit.
  const owner = new Map();
  for (const unit of queue.units) for (const screen of unit.designScreens) owner.set(screen, (owner.get(screen) ?? 0) + 1);
  for (const screen of inventory.screens) if (owner.get(screen.id) !== 1) problems.push(`screen ${screen.id} is in ${owner.get(screen.id) ?? 0} units`);
  // Unit routes exist in the route registry.
  const paths = [...readFileSync("web/src/routes.ts", "utf8").matchAll(/path: "([^"]+)"/g)].map((match) => match[1]);
  for (const unit of queue.units) {
    if (unit.canonicalRoute?.startsWith("/") && !unit.canonicalRoute.startsWith("/card") && !paths.includes(unit.canonicalRoute))
      problems.push(`${unit.id}: route ${unit.canonicalRoute} is not in web/src/routes.ts`);
  }
  if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
  console.log(`queue and ledger consistent: ${queue.units.length} units, ${inventory.screens.length} screens`);
}

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const MANIFEST = "docs/migration/handoff/MANIFEST.json";

function handoff() {
  const problems = [];
  const fail = (message) => problems.push(message);
  if (!existsSync(MANIFEST)) { console.log(`missing ${MANIFEST}`); process.exit(1); }
  const manifest = read(MANIFEST);

  for (const [path, expected] of Object.entries(manifest.frozenFiles)) {
    if (!existsSync(path)) fail(`missing frozen file ${path}`);
    else if (sha256(path) !== expected) fail(`changed since handoff: ${path} (run handoff-refresh if the change is intended)`);
  }
  for (const path of [...manifest.mutableFiles, manifest.decisions, manifest.blockers, manifest.ownerRules, manifest.startHere,
    manifest.foundationStatus, manifest.nextSteps, manifest.setup, manifest.queue.file, manifest.queue.ledger, manifest.audit.snapshot,
    manifest.design.inventory, manifest.design.extractionTool, manifest.design.canvas, manifest.design.extraArtboard]) {
    if (!existsSync(path)) fail(`missing ${path}`);
  }
  for (const path of [manifest.decisions, manifest.blockers, manifest.audit.snapshot, manifest.design.inventory, "docs/migration/06-route-registry.json"]) {
    try { read(path); } catch { fail(`not valid JSON: ${path}`); }
  }

  const archive = manifest.design.archive;
  if (existsSync(archive.path)) {
    if (sha256(archive.path) !== archive.sha256) fail("design archive checksum differs from the manifest");
  } else fail(`design archive missing at ${archive.path} (the original upload path is ${archive.originalUpload})`);

  const reference = manifest.design.extractedReference;
  try {
    const listing = execFileSync("sh", ["-c", `cd ${reference.path} && find . -type f | sort | xargs sha256sum | sha256sum | cut -d' ' -f1`], { encoding: "utf8" }).trim();
    if (listing !== reference.treeSha256) fail("docs/arc/design/source differs from the fingerprint in the manifest (the design must stay unchanged)");
  } catch { fail("could not fingerprint docs/arc/design/source"); }

  const base = manifest.repository.baseSha;
  try { execFileSync("git", ["merge-base", "--is-ancestor", base, "HEAD"]); } catch { fail(`base ${base.slice(0, 7)} is not an ancestor of HEAD`); }
  if (git("branch", "--show-current") !== manifest.repository.branch) fail(`expected branch ${manifest.repository.branch}, on ${git("branch", "--show-current")}`);

  for (const skill of manifest.claudeCode.skills) if (!existsSync(`.claude/skills/${skill}/SKILL.md`)) fail(`missing skill ${skill}`);
  if (!(statSync(manifest.setup).mode & 0o100)) fail("setup.sh is not executable");
  if (!read(manifest.queue.file).units.some((unit) => unit.id === manifest.queue.firstEligible)) fail("first eligible unit is not in the queue");

  const decisionIds = new Set([...read(manifest.decisions).resolved, ...read(manifest.decisions).open].map((entry) => entry.id));
  const decisionsText = readFileSync("docs/migration/11-product-decisions.md", "utf8");
  for (const id of decisionIds) if (!decisionsText.includes(id)) fail(`${id} is not in 11-product-decisions.md`);

  try { execFileSync("node", ["tools/migration/cli.mjs", "validate"], { encoding: "utf8" }); } catch (error) { fail("queue and ledger validation failed: " + (error.stdout ?? "").trim()); }

  if (problems.length) { console.log(problems.join("\n")); console.log(`${problems.length} problem(s)`); process.exit(1); }
  console.log(`OK: ${Object.keys(manifest.frozenFiles).length} frozen files match, design archive and reference fingerprint match, base ${base.slice(0, 7)} is an ancestor of HEAD, ${manifest.claudeCode.skills.length} skills present`);
  console.log(`uncommitted paths: ${git("status", "--short").split("\n").filter(Boolean).length}; identity in checkout: ${git("config", "user.name")} <${git("config", "user.email")}>`);
}

function handoffRefresh() {
  const manifest = read(MANIFEST);
  for (const path of Object.keys(manifest.frozenFiles)) manifest.frozenFiles[path] = sha256(path);
  manifest.repository.headShaAtHandoff = git("rev-parse", "HEAD");
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`refreshed ${Object.keys(manifest.frozenFiles).length} checksums`);
}

const [command, argument] = process.argv.slice(2);
const commands = { status, next, validate, handoff, "handoff-refresh": handoffRefresh, context: () => context(argument) };
if (!commands[command]) { console.error("Usage: cli.mjs status|next|context <UnitId>|validate|handoff|handoff-refresh"); process.exit(2); }
commands[command]();
