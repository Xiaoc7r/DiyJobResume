// Small immutable results only. Limits account for key and result bytes together.
export function boundedCache<T>(limit = 1024, maxBytes = 2_000_000) {
  const entries = new Map<string, { value: T; bytes: number }>();
  let bytes = 0;
  return {
    get(key: string) {
      const hit = entries.get(key);
      if (!hit) return undefined;
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    },
    set(key: string, value: T, resultLength = 0) {
      const cost = (key.length + resultLength) * 2;
      const old = entries.get(key);
      if (old) {
        bytes -= old.bytes;
        entries.delete(key);
      }
      if (cost > maxBytes) return;
      entries.set(key, { value, bytes: cost });
      bytes += cost;
      while (entries.size > limit || bytes > maxBytes) {
        const oldest = entries.keys().next().value!;
        bytes -= entries.get(oldest)!.bytes;
        entries.delete(oldest);
      }
    },
    clear() {
      entries.clear();
      bytes = 0;
    },
  };
}
