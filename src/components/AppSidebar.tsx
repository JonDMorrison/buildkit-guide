import { useMemo } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useNavigationTabs, TabConfig } from "@/hooks/useNavigationTabs";
import { Skeleton } from "@/components/ui/skeleton";
import { NavItem } from "./sidebar/NavItem";
import { NavSection } from "./sidebar/NavSection";
import { SidebarProjectSwitcher } from "./sidebar/SidebarProjectSwitcher";
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
    paths: ["/dashboard", "/tasks", "/time", "/hours-tracking", "/lookahead", "/manpower"],
  },
  {
    title: "Financial",
    paths: ["/job-cost-report", "/invoicing", "/estimates", "/quotes", "/receipts", "/insights"],
  },
  {
    title: "Field & Compliance",
    paths: ["/drawings", "/deficiencies", "/safety"],
  },
];

export const AppSidebar = () => {
  const { visibleTabs, isLoading } = useNavigationTabs();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
      {/* Background — theme-aware */}
      <div className="absolute inset-0 pointer-events-none bg-sidebar" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015] dark:block hidden"
        style={{
          backgroundImage:
            "linear-gradient(hsl(215 20% 40% / 0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(215 20% 40% / 0.2) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

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
        "flex items-center justify-center rounded-md transition-colors duration-150",
        "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
        collapsed ? "h-8 w-8" : "h-7 w-7",
      )}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <PanelLeft className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
    </button>
  );
}
