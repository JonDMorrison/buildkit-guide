import { ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  /** Dashboard content */
  children: ReactNode;
  /** Additional className for the inner container */
  className?: string;
}

/**
 * Top-level wrapper for dashboard pages.
 * Provides the Layout shell plus consistent padding.
 */
export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <Layout>
      <div className={cn("dashboard-container py-6 pb-24 md:pb-8", className)}>
        <div className="dashboard-section space-y-6">
          {children}
        </div>
      </div>
    </Layout>
  );
}
