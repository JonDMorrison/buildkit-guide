import { useMemo } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useNavigationTabs, TabConfig } from "@/hooks/useNavigationTabs";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { NavItem } from "./sidebar/NavItem";
import { NavSection } from "./sidebar/NavSection";
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
    paths: ["/job-cost-report", "/invoicing", "/receipts", "/insights"],
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
  const { currentProjectId } = useCurrentProject();

  const { data: currentProject } = useQuery({
    queryKey: ["sidebar-project", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", currentProjectId)
        .maybeSingle();
      return data;
    },
    enabled: !!currentProjectId,
    staleTime: 30_000,
  });

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
      {/* Background gradient + blueprint overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, hsl(222 47% 11%) 0%, hsl(222 55% 9%) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(210 40% 50% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(210 40% 50% / 0.3) 1px, transparent 1px)",
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
          <div className="border-t border-white/[0.06]" />
        </div>

        {/* ── Contextual project label ── */}
        {currentProject && !collapsed && (
          <div className="px-4 mb-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-primary/60">
              Project
            </span>
            <p className="text-xs font-semibold text-sidebar-foreground/90 truncate mt-0.5">
              {currentProject.name}
            </p>
          </div>
        )}

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
        "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-white/[0.06]",
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
