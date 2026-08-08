// jsdom test helper — NOT a test file. Node ≥22 defines an experimental
// `localStorage` global that is undefined without --localstorage-file, and
// vitest's jsdom population won't override existing Node globals, so neither
// `localStorage` nor `window.localStorage` works in jsdom tests. Tests that
// exercise storage install this in-memory implementation over the dead global.
export function installMemoryLocalStorage(): void {
  let map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear: () => {
      map = new Map();
    },
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}
