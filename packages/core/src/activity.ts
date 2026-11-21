/** A single field change inside an Activity. */
export interface FieldChange {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

/**
 * Generic deep diff of two plain JSON objects, producing human-labelled FieldChanges.
 * `labels` maps a path prefix (e.g. "items.<key>") to a friendly name.
 */
export function diffValues(before: unknown, after: unknown, path = "", labelFor: (path: string) => string = (p) => p): FieldChange[] {
  if (deepEqual(before, after)) return [];
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (isObj(before) && isObj(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].flatMap((k) => diffValues(before[k], after[k], path ? `${path}.${k}` : k, labelFor));
  }
  return [{ path, label: labelFor(path), before: before ?? null, after: after ?? null }];
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
