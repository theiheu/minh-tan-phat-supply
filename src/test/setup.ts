import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn();
}

import { beforeEach, afterEach } from "vitest";

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  const customError = vi.fn((...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : args.join(" ");
    if (
      msg.includes("Warning: ReactDOM.render is no longer supported") ||
      msg.includes("Not implemented: window.scrollTo") ||
      msg.includes("DeprecationWarning: punycode")
    ) {
      return originalConsoleError(...args);
    }
    originalConsoleError(...args);
  });
  console.error = customError;

  const customWarn = vi.fn((...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : args.join(" ");
    if (msg.includes("React Router")) return originalConsoleWarn(...args);
    originalConsoleWarn(...args);
  });
  console.warn = customWarn;
});

afterEach(() => {
  // If console.error was assigned to our mock, check it.
  if ((console.error as any).mock) {
    const calls = (console.error as any).mock.calls;
    if (calls.length > 0) {
      throw new Error(`Unexpected console.error was called ${calls.length} times`);
    }
  }
  if ((console.warn as any).mock) {
    const calls = (console.warn as any).mock.calls;
    if (calls.length > 0) {
      throw new Error(`Unexpected console.warn was called ${calls.length} times`);
    }
  }
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});



