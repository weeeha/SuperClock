// Test helper, NOT a test file.
//
// Node >= 22 defines an experimental `localStorage` global that throws unless
// the process was started with --localstorage-file, and vitest's jsdom
// environment will not overwrite an existing Node global. So inside a jsdom
// test neither `localStorage` nor `window.localStorage` is usable.
//
// This installs an in-memory Storage over that dead global. It runs from
// vite.config.ts `test.setupFiles`, which executes before any test module is
// imported — that ordering matters, because modules like src/apps/todo/store
// are wired up at import time (`createTodoStore(localStorage)`), so a helper
// called from beforeAll() would already be too late.
function memoryStorage(): Storage {
  let map = new Map<string, string>();
  return {
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
}

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage(),
  configurable: true,
  writable: true,
});
