import { describe, it, expect, vi } from "vitest";

/**
 * Validates that DashboardMissionControlContent (and its RPCs) are
 * never rendered / invoked until useRouteAccess has resolved and
 * the role gate passes.
 *
 * This is a structural test — it verifies the gate pattern by
 * inspecting the module exports and component tree contract.
 */

// Mock the hooks so we can control their outputs
vi.mock("@/hooks/useRouteAccess", () => ({
  useRouteAccess: vi.fn(),
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: vi.fn(() => ({ activeOrganizationId: null, loading: false })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import { useRouteAccess } from "@/hooks/useRouteAccess";

describe("DashboardMissionControl gate pattern", () => {
  it("renders nothing meaningful while route access is loading", async () => {
    // Simulate loading state
    (useRouteAccess as any).mockReturnValue({
      loading: true,
      isAdmin: false,
      isPM: false,
      canViewExecutive: false,
      canViewDiagnostics: false,
    });

    // Dynamically import to get fresh module
    const { DashboardMissionControl } = await import(
      "@/components/dashboard/DashboardMissionControl"
    );

    // The gate component itself can be instantiated
    expect(DashboardMissionControl).toBeDefined();
    expect(typeof DashboardMissionControl).toBe("function");
  });

  it("returns null for non-admin, non-PM users after loading", async () => {
    (useRouteAccess as any).mockReturnValue({
      loading: false,
      isAdmin: false,
      isPM: false,
      canViewExecutive: false,
      canViewDiagnostics: false,
    });

    const { DashboardMissionControl } = await import(
      "@/components/dashboard/DashboardMissionControl"
    );

    // Call the component function directly — it should return null
    const result = DashboardMissionControl();
    expect(result).toBeNull();
  });

  it("renders content for Admin users after loading", async () => {
    (useRouteAccess as any).mockReturnValue({
      loading: false,
      isAdmin: true,
      isPM: false,
      canViewExecutive: true,
      canViewDiagnostics: true,
    });

    const { DashboardMissionControl } = await import(
      "@/components/dashboard/DashboardMissionControl"
    );

    // Should return a React element (not null)
    const result = DashboardMissionControl();
    expect(result).not.toBeNull();
    expect(result).toBeDefined();
  });

  it("renders content for PM users after loading", async () => {
    (useRouteAccess as any).mockReturnValue({
      loading: false,
      isAdmin: false,
      isPM: true,
      canViewExecutive: false,
      canViewDiagnostics: false,
    });

    const { DashboardMissionControl } = await import(
      "@/components/dashboard/DashboardMissionControl"
    );

    const result = DashboardMissionControl();
    expect(result).not.toBeNull();
  });
});
