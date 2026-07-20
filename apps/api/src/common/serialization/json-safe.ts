import { Prisma } from "@prisma/client";

const INSTALLED = Symbol.for("the-eye.json-safe.prototypes");

/**
 * Convert Prisma/runtime values that JSON.stringify cannot handle into
 * JSON-safe primitives. Used by the global interceptor and unit tests.
 */
export function toJsonSafe<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map((item) => walk(item));
  if (typeof value === "object") {
    // Buffers / typed arrays: leave as-is for Nest/Express to handle.
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return value;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      // Preserve class instances (HttpException, streams, etc.) unless plain data.
      // Plain Prisma result rows use Object.prototype.
      if (!isPlainObject(value)) return value;
    }
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      output[key] = walk(input[key]);
    }
    return output;
  }
  return value;
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Patch prototypes so JSON.stringify never throws on BigInt (and Decimal
 * keeps emitting a string). Safe to call multiple times.
 */
export function installJsonSafePrototypes(): void {
  const globalObject = globalThis as typeof globalThis & { [INSTALLED]?: boolean };
  if (globalObject[INSTALLED]) return;
  globalObject[INSTALLED] = true;

  Object.defineProperty(BigInt.prototype, "toJSON", {
    configurable: true,
    writable: true,
    value: function toJSON(this: bigint) {
      return this.toString();
    },
  });

  const decimalProto = Prisma.Decimal.prototype as { toJSON?: () => string };
  if (typeof decimalProto.toJSON !== "function") {
    Object.defineProperty(Prisma.Decimal.prototype, "toJSON", {
      configurable: true,
      writable: true,
      value: function toJSON(this: Prisma.Decimal) {
        return this.toString();
      },
    });
  }
}
