import { readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";

type TestCase = { name: string; fn: () => unknown | Promise<unknown> };
const tests: TestCase[] = [];

function findSpecs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findSpecs(full);
    return full.endsWith(".spec.ts") ? [full] : [];
  });
}

(globalThis as any).describe = (_title: string, fn: () => void) => fn();
(globalThis as any).it = (name: string, fn: () => unknown | Promise<unknown>) => {
  tests.push({ name, fn });
};
(globalThis as any).expect = (actual: unknown) => ({
  toBe(expected: unknown) {
    if (actual !== expected) throw new Error(`Expected ${String(expected)} but received ${String(actual)}`);
  },
  toEqual(expected: unknown) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    }
  },
  toBeTruthy() {
    if (!actual) throw new Error(`Expected truthy value but received ${String(actual)}`);
  },
  toContain(expected: string) {
    if (typeof actual !== "string" || !actual.includes(expected)) {
      throw new Error(`Expected ${String(actual)} to contain ${expected}`);
    }
  },
});

async function run() {
  const libDir = resolve(__dirname);
  for (const spec of findSpecs(libDir)) {
    await import(pathToFileURL(spec).href);
  }
  for (const test of tests) {
    await test.fn();
    console.log(`✓ ${test.name}`);
  }
  console.log(`${tests.length} admin-web tests passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
