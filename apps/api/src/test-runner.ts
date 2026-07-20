import { readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { isDeepStrictEqual } from "util";
import { installJsonSafePrototypes } from "./common/serialization/json-safe";

installJsonSafePrototypes();

type TestCase = { name: string; fn: () => unknown | Promise<unknown> };
const tests: TestCase[] = [];

function findSpecs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findSpecs(full);
    return full.endsWith(".spec.ts") ? [full] : [];
  });
}

function makeMock(impl?: (...args: unknown[]) => unknown) {
  const fn: any = (...args: unknown[]) => {
    fn.mock.calls.push(args);
    if (fn.mock.onceQueue.length > 0) {
      const queued = fn.mock.onceQueue.shift();
      return queued instanceof Promise ? queued : Promise.resolve(queued);
    }
    if (fn.mock.impl) return fn.mock.impl(...args);
    return undefined;
  };
  fn.mock = { calls: [] as unknown[][], impl, onceQueue: [] as unknown[] };
  fn.mockResolvedValue = (value: unknown) => {
    fn.mock.impl = () => Promise.resolve(value);
    return fn;
  };
  fn.mockResolvedValueOnce = (value: unknown) => {
    fn.mock.onceQueue.push(value);
    return fn;
  };
  fn.mockReturnValue = (value: unknown) => {
    fn.mock.impl = () => value;
    return fn;
  };
  fn.mockImplementation = (next: (...args: unknown[]) => unknown) => {
    fn.mock.impl = next;
    return fn;
  };
  return fn;
}

function matches(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === "object" && (expected as any).__objectContaining) {
    return Object.entries((expected as any).sample).every(([key, value]) => matches((actual as any)?.[key], value));
  }
  if (expected && typeof expected === "object" && (expected as any).__arrayContaining) {
    return Array.isArray(actual) && (expected as any).sample.every((item: unknown) => actual.some((actualItem) => matches(actualItem, item)));
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((item, index) => matches(actual[index], item));
  }
  return isDeepStrictEqual(actual, expected);
}

function expectValue(actual: any, negated = false) {
  const assert = (pass: boolean, message: string) => {
    if (negated ? pass : !pass) throw new Error(message);
  };
  const api: any = {
    get not() {
      return expectValue(actual, !negated);
    },
    get rejects() {
      return {
        async toBeInstanceOf(type: new (...args: any[]) => unknown) {
          try {
            await actual;
          } catch (error) {
            assert(error instanceof type, `Expected rejection to be instance of ${type.name}`);
            return;
          }
          throw new Error("Expected promise to reject");
        },
      };
    },
    toBe(expected: unknown) {
      assert(Object.is(actual, expected), `Expected ${actual} to be ${expected}`);
    },
    toEqual(expected: unknown) {
      assert(matches(actual, expected), `Expected values to be deeply equal`);
    },
    toContain(expected: unknown) {
      assert(actual?.includes?.(expected), `Expected value to contain ${expected}`);
    },
    toHaveLength(expected: number) {
      assert(actual?.length === expected, `Expected length ${expected}, got ${actual?.length}`);
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert(actual >= expected, `Expected ${actual} to be >= ${expected}`);
    },
    toBeGreaterThan(expected: number) {
      assert(actual > expected, `Expected ${actual} to be > ${expected}`);
    },
    toBeLessThan(expected: number) {
      assert(actual < expected, `Expected ${actual} to be < ${expected}`);
    },
    toBeInstanceOf(type: new (...args: any[]) => unknown) {
      assert(actual instanceof type, `Expected value to be instance of ${type.name}`);
    },
    toMatch(pattern: RegExp) {
      assert(pattern.test(String(actual)), `Expected ${actual} to match ${pattern}`);
    },
    toThrow(type?: new (...args: any[]) => unknown) {
      let thrown: unknown;
      try {
        actual();
      } catch (error) {
        thrown = error;
      }
      assert(Boolean(thrown), "Expected function to throw");
      if (type) assert(thrown instanceof type, `Expected thrown error to be instance of ${type.name}`);
    },
    toHaveBeenCalled() {
      assert((actual.mock?.calls.length ?? 0) > 0, "Expected mock to have been called");
    },
    toHaveBeenCalledTimes(times: number) {
      assert((actual.mock?.calls.length ?? 0) === times, `Expected mock to be called ${times} times`);
    },
    toHaveBeenCalledWith(...expectedArgs: unknown[]) {
      const calls = actual.mock?.calls ?? [];
      assert(calls.some((call: unknown[]) => matches(call, expectedArgs)), `Expected mock to be called with matching arguments`);
    },
  };
  return api;
}

(globalThis as any).describe = (_name: string, fn: () => void) => fn();
(globalThis as any).it = (name: string, fn: () => unknown | Promise<unknown>) => tests.push({ name, fn });
(globalThis as any).test = (globalThis as any).it;
(globalThis as any).expect = Object.assign(expectValue, {
  objectContaining: (sample: Record<string, unknown>) => ({ __objectContaining: true, sample }),
  arrayContaining: (sample: unknown[]) => ({ __arrayContaining: true, sample }),
});
(globalThis as any).jest = { fn: makeMock };

async function main() {
  for (const spec of findSpecs(resolve(__dirname))) {
    await import(pathToFileURL(spec).href);
  }

  let failed = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`PASS ${test.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${test.name}`);
      console.error(error);
    }
  }
  console.log(`${tests.length - failed}/${tests.length} tests passed`);
  if (failed > 0) process.exit(1);
}

void main();
