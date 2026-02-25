import { ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Top-level wrapper for dashboard pages.
 * Provides consistent spacing: 6-unit vertical rhythm, constrained width.
 */
export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <Layout>
      <div className={cn("dashboard-container py-6 pb-24 md:pb-8", className)}>
        <div className="space-y-8">
          {children}
        </div>
      </div>
    </Layout>
  );
}
