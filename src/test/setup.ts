import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Supabase environment variables for tests
vi.stubEnv("VITE_SUPABASE_URL", "https://dummy.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "dummy-key");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
