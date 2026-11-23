import { existsSync, writeFileSync } from "node:fs";

// Exits on the first start and records its port; later starts run the real server.
const marker = process.env.FLAKY_MARKER;
if (!existsSync(marker)) {
  writeFileSync(marker, process.env.PORT);
  process.exit(1);
}
await import("../../index.mjs");
