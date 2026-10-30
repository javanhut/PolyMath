// Validate one unit file while writing it, without loading the rest of the
// curriculum:  bun scripts/check-unit.ts src/curriculum/algebra1/unit3.ts
import { resolve } from "node:path";
import type { Unit } from "../src/curriculum/types";
import { validateUnit } from "../src/curriculum/validate";

const file = process.argv[2];
if (!file) {
  console.error("usage: bun scripts/check-unit.ts <unit file>");
  process.exit(2);
}
const mod = (await import(resolve(file))) as Record<string, unknown>;
const units = Object.values(mod).filter((v): v is Unit => typeof v === "object" && v !== null && Array.isArray((v as Unit).lessons));
if (units.length === 0) {
  console.error(`${file} exports no Unit`);
  process.exit(2);
}

let failed = false;
for (const unit of units) {
  const r = validateUnit(unit);
  const written = unit.lessons.filter((l) => l.blocks?.length).length;
  console.log(`\n${unit.title}: ${written}/${unit.lessons.length} lessons written, ${r.total} generated problems, ${r.verified} answer keys independently verified (${r.total ? Math.round((100 * r.verified) / r.total) : 0}%)`);
  console.log("\nSample problems:");
  for (const s of r.samples) console.log("  " + s);
  if (r.errors.length) {
    failed = true;
    console.log(`\n${r.errors.length} error(s):`);
    for (const e of r.errors) console.log("  ✗ " + e);
  } else {
    console.log("\n✓ no errors");
  }
}
process.exit(failed ? 1 : 0);
