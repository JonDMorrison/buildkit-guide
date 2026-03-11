import { useMemo } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useNavigationTabs, TabConfig } from "@/hooks/useNavigationTabs";
import { Skeleton } from "@/components/ui/skeleton";
import { NavItem } from "./sidebar/NavItem";
import { NavSection } from "./sidebar/NavSection";
import { SidebarProjectSwitcher } from "./sidebar/SidebarProjectSwitcher";
import { CertificationBadge } from "@/components/CertificationBadge";
import { useCertificationTier } from "@/hooks/useCertificationTier";
import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/* ── Section definitions keyed by route path ── */
interface SectionDef {
  title: string;
  paths: string[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "Operations",
    paths: ["/dashboard", "/workflow", "/tasks", "/time", "/hours-tracking", "/lookahead", "/manpower", "/daily-logs"],
  },
  {
    title: "Financial",
    paths: ["/job-cost-report", "/invoicing", "/estimates", "/quotes", "/proposals", "/change-orders", "/receipts", "/insights", "/intelligence"],
  },
  {
    title: "Field & Compliance",
    paths: ["/drawings", "/deficiencies", "/safety", "/documents"],
  },
  {
    title: "Executive",
    paths: ["/executive"],
  },
  {
    title: "Admin",
    paths: ["/users", "/data-health", "/insights/ai-brain", "/settings/labor-rates", "/playbooks", "/release"],
  },
];

export const AppSidebar = () => {
  const { visibleTabs, isLoading } = useNavigationTabs();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { tier } = useCertificationTier();

  /* Build sections from visible tabs */
  const sections = useMemo(() => {
    const tabMap = new Map<string, TabConfig>();
    visibleTabs.forEach((t) => tabMap.set(t.path, t));

    return SECTIONS.map((sec) => ({
      ...sec,
      tabs: sec.paths
        .map((p) => tabMap.get(p))
        .filter((t): t is TabConfig => t != null),
    })).filter((sec) => sec.tabs.length > 0);
  }, [visibleTabs]);

  return (
    <Sidebar collapsible="icon">
      {/* Background — theme-aware premium effects */}
      <div className="absolute inset-0 pointer-events-none bg-sidebar" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:block hidden"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--sidebar-primary)) 0.5px, transparent 0.5px), linear-gradient(90deg, hsl(var(--sidebar-primary)) 0.5px, transparent 0.5px)",
          backgroundSize: "32px 32px",
        }}
      />
      
      {/* Subtle radial glow at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-sidebar-primary/5 blur-[120px] pointer-events-none opacity-50" />

      <SidebarContent className="relative z-10 flex flex-col h-full py-3 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {/* ── Collapse toggle ── */}
        <div className={cn("flex items-center mb-1", collapsed ? "justify-center px-1" : "justify-end px-3")}>
          <SidebarCollapseToggle collapsed={collapsed} />
        </div>

        {/* ── Divider ── */}
        <div className={cn("mb-2", collapsed ? "mx-2" : "mx-4")}>
          <div className="border-t border-sidebar-border" />
        </div>

        {/* ── Project Switcher ── */}
        <SidebarProjectSwitcher collapsed={collapsed} />

        {/* ── Navigation sections ── */}
        {isLoading ? (
          <div className="px-3 space-y-3 mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2">
                <Skeleton className="h-4 w-4 rounded bg-white/10" />
                <Skeleton className="h-4 w-24 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : (
          sections.map((section) => (
            <NavSection key={section.title} title={section.title} collapsed={collapsed}>
              {section.tabs.map((tab) => (
                <NavItem
                  key={tab.path}
                  label={tab.name}
                  icon={tab.icon}
                  route={tab.path}
                  collapsed={collapsed}
                />
              ))}
            </NavSection>
          ))
        )}

        {/* Certification Badge */}
        {tier !== 'none' && !collapsed && (
          <div className="px-4 mt-auto pt-3 pb-2">
            <div className="flex items-center justify-center">
              <CertificationBadge tier={tier} />
            </div>
          </div>
        )}
        {tier !== 'none' && collapsed && (
          <div className="flex justify-center mt-auto pt-3 pb-2">
            <CertificationBadge tier={tier} compact />
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

/* ── Collapse toggle button ── */
function SidebarCollapseToggle({ collapsed }: { collapsed: boolean }) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        "flex items-center justify-center rounded-lg transition-all duration-300 ease-in-out",
        "text-sidebar-foreground/30 hover:text-sidebar-foreground/80 hover:bg-sidebar-primary/10 hover:shadow-sm",
        "active:scale-90",
        collapsed ? "h-9 w-9" : "h-8 w-8",
      )}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <PanelLeft className="h-4.5 w-4.5 transition-transform duration-500 hover:scale-110" />
      ) : (
        <PanelLeftClose className="h-4.5 w-4.5 transition-transform duration-500 hover:scale-110" />
      )}
    </button>
  );
}
