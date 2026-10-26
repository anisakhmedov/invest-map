// MapLibre runs tile parsing in a module worker. Bundlers do not emit it reliably, so we serve
// the two worker files as plain static assets from /maplibre/ and point MapLibre at them.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

if (!existsSync(from)) {
  console.warn("maplibre-gl is not installed, skipping worker copy");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(from, file), join(to, file));
}
console.log("MapLibre worker files copied to public/maplibre");
