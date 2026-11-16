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

// Includes pending keys and completed values. Evicted tasks may finish, but must
// never put themselves back into the cache or remove a newer request's entry.
export function boundedAsyncCache<T>(
  limit: number,
  maxBytes: number,
  size: (value: T) => number,
) {
  const entries = new Map<string, { promise: Promise<T>; bytes: number }>();
  let bytes = 0;
  const remove = (key: string) => {
    const entry = entries.get(key);
    if (entry) {
      bytes -= entry.bytes;
      entries.delete(key);
    }
  };
  const trim = () => {
    while (entries.size > limit || bytes > maxBytes)
      remove(entries.keys().next().value!);
  };
  return (key: string, create: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit) {
      entries.delete(key);
      entries.set(key, hit);
      return hit.promise;
    }
    const promise = Promise.resolve().then(create),
      entry = { promise, bytes: key.length * 2 };
    if (entry.bytes <= maxBytes) {
      entries.set(key, entry);
      bytes += entry.bytes;
      trim();
      void promise.then(
        (value) => {
          if (entries.get(key) !== entry) return;
          const extra = size(value);
          entry.bytes += extra;
          bytes += extra;
          if (entry.bytes > maxBytes) remove(key);
          trim();
        },
        () => {
          if (entries.get(key) === entry) remove(key);
        },
      );
    }
    return promise;
  };
}
