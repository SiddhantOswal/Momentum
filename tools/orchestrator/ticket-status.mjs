import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const HEADING = /^### (ARC-[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)?) (.+?)(?: \((P[0-9])\b.*\))?\s*$/;

export function parseTickets(text) {
  return text.split("\n").map((line) => HEADING.exec(line)).filter(Boolean)
    .map(([, id, title, priority]) => ({ id, title: title.replace(/\s*\(P[0-9].*$/, ""), priority: priority ?? "P?" }));
}

export function mergedIds(subjects) {
  const ids = new Set();
  for (const subject of subjects) {
    const match = /^Merge (ARC-[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)?)(?: and ([A-Z0-9]+-[A-Z0-9]+))?/.exec(subject);
    if (!match) continue;
    ids.add(match[1]);
    if (match[2]) ids.add(`ARC-${match[2]}`);
  }
  return ids;
}

export function summarise(tickets, merged, doneWithoutMerge = new Set()) {
  const rows = tickets.map((ticket) => ({ ...ticket, state: merged.has(ticket.id) || doneWithoutMerge.has(ticket.id) ? "MERGED" : "OPEN" }));
  const open = rows.filter((row) => row.state === "OPEN");
  return { rows, open, openByPriority: Object.fromEntries(["P0", "P1", "P2", "P?"].map((p) => [p, open.filter((row) => row.priority === p).length])) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(new URL("../..", import.meta.url).pathname);
  const dir = path.join(root, "docs/arc/delivery/tickets");
  const tickets = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md")
    .flatMap((f) => parseTickets(readFileSync(path.join(dir, f), "utf8")));
  const subjects = execFileSync("git", ["log", "--merges", "--format=%s", "arc/main"], { cwd: root, encoding: "utf8" }).split("\n");
  let doneWithoutMerge = new Set();
  try { doneWithoutMerge = new Set(readFileSync(path.join(root, "docs/arc/delivery/external/done-without-merge.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))); } catch { /* optional file */ }
  const { rows, open, openByPriority } = summarise(tickets, mergedIds(subjects), doneWithoutMerge);
  console.log(`Tickets: ${rows.length}; merged or done: ${rows.length - open.length}; open: ${open.length} (P0 ${openByPriority.P0}, P1 ${openByPriority.P1}, P2 ${openByPriority.P2}, no priority ${openByPriority["P?"]})`);
  for (const priority of ["P0", "P1", "P2", "P?"]) {
    const list = open.filter((row) => row.priority === priority);
    if (list.length) console.log(`\nOpen ${priority}:\n${list.map((row) => `  ${row.id}  ${row.title}`).join("\n")}`);
  }
}
